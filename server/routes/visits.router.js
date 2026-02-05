const express = require('express');
const {
    rejectUnauthenticated,
  } = require('../modules/authentication-middleware');
const pool = require('../modules/pool');
const router = express.Router();

// GET route requests all columns from clientVisits from database 
// (ultimately for only the authenticated field_tech_id)
// route sends an array back to the visits saga


// router.get('/visits', rejectUnauthenticated, (req, res) => {

router.get('/', (req, res) => {
        // console.log('/api/Visits received a request.')

    sqlText = `
        SELECT * FROM "client_visits";
    `;

    pool.query (sqlText)
        .then((result) => {
            res.send(result.rows);
        })
        .catch((dbErr) => {
            console.log('Error GET /api/client_visits ', dbErr);
            res.sendStatus(500);
        });
})

//POST route sends an INSERT query to add a row the client_visits table

//router.post('/visits', rejectUnauthenticated, async (req, res) => {

router.post('/', async (req, res) => {

    console.log('visits router request', req.body)

    let connection;
    try {
        connection = await pool.connect()

        await connection.query('BEGIN;')

        // let visitExample = {
        //     clientId: 5000,
        //     fieldTechId: 3000,
        //     timelyNote: 'spray palm trees'
        // };

        let visit = req.body
        const clientId = visit.clientId
        const fieldTechId = visit.fieldTechId
        const timelyNote = visit.timelyNote  

        const insertQuery = `
        INSERT INTO client_visits (client_id, field_tech_id, timely_note)
        VALUES ($1, $2, $3)
        RETURNING id;
        `;

        await connection.query(insertQuery, [clientId, fieldTechId, timelyNote]);

        await connection.query('Commit;')

        res.sendStatus(201);
    } catch (error) {
        console.log('error in /api/visits/ POST route: ', error)
        await connection.query('ROLLBACK;')
        res.sendStatus(500);
    } finally {
        await connection.release()
    }
});


//DELETE route sends a DELETE query to the client_visits table
// router.delete('/visits/:id', rejectUnauthenticated, (req, res) => {

    router.delete('/visits/:id', (req, res) => {
        // Log the request parameter for debugging
        console.log('in /api/visits DELETE route and the param is:', req.params.id, typeof req.params.id);
    
        let visitToDelete = req.params.id;
        
        // SQL statement to delete a row from client_visits by ID
        const sqlText = `
            DELETE FROM "client_visits"
            WHERE "id" = $1;
        `;
    
        const sqlValue = [visitToDelete];
    
        // Execute the query
        pool.query(sqlText, sqlValue)
            .then((result) => {
                // Check if any rows were deleted
                if (result.rowCount > 0) {
                    res.sendStatus(200); // Successful deletion
                } else {
                    res.sendStatus(404); // No rows found with that ID
                }
            })
            .catch((dbErr) => {
                console.log('Error in /client_visit/:id DELETE route:', dbErr);
                res.sendStatus(500); // Server error
            });
    });


//PUT route sends an UPDATE query to change the
// field_tech_id on client_visits table
// router.put('/field_tech_id/:id', rejectUnauthenticated, async (req, res) => {

router.put('/', async (req, res) => {

   // const { clientName, fieldTechId } = req.body;
   const clientName = req.body.clientName 
   const fieldTechId = req.body.fieldTechId

    console.log(`Received request to update field_tech_id to ${fieldTechId} for client: ${clientName}`);

    const queryText = `
        UPDATE client_visits
        SET field_tech_id = $1
        WHERE client_id = (
            SELECT id FROM client_list WHERE client_name = $2
        );
    `;

		try {
            // Run the query to update field_tech_id based on client_name
            await pool.query(queryText, [fieldTechId, clientName]);
            res.sendStatus(200);
          } catch (err) {
            console.error('Error updating field tech ID:', err);
            res.sendStatus(500);
          }
        });
        
        module.exports = router;