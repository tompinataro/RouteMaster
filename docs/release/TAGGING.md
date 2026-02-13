# Tagging Guide — v1.0.1

Create and push a lightweight tag for this release.

Commands
```
# Ensure main is up to date
git checkout main && git pull

# Create tag
git tag v1.0.1 -m "Bloom Steward 1.0.1"

# Push tag
git push origin v1.0.1

# (Optional) push to Heroku remote not needed for tags
```

Notes
- Tag after the store submission has been created to align with metadata.
- If you need to re-tag, delete and recreate:
```
git tag -d v1.0.1 && git push origin :refs/tags/v1.0.1
git tag v1.0.1 -m "Bloom Steward 1.0.1" && git push origin v1.0.1
```

