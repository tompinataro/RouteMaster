# Export Compliance (Encryption Disclosure)

Bloom Steward uses standard encryption solely for app functionality:

- HTTPS/TLS for client–server communication
- Token‑based authentication (JWT) over HTTPS
- No custom or proprietary encryption algorithms
- No end‑to‑end user‑controlled encryption features
- No MDM/enterprise or government‑specific encryption

Apple Export Compliance Answers (Guidance)
- Does your app use encryption? Yes
- Is your app using encryption only to authenticate, verify, or enable HTTPS? Yes
- Is your app exempt under Category 5, Part 2 of the U.S. Export Administration Regulations (EAR)? Yes — standard encryption only
- Are you using any proprietary or non‑standard cryptography? No
- Does your app facilitate encrypted communications beyond standard HTTPS (e.g., E2EE messaging)? No

Outcome
- Select the standard encryption exemption path in App Store Connect. You should not need to provide a CCATS for this app.

