# Signtify Cloud Functions

## adminDeleteUser

When an admin clicks **Delete** in User Management, this function removes the user from:

1. **Firestore** – the `users/{uid}` document  
2. **Firebase Authentication** – the auth account  

So the deleted user **cannot log in** anymore.

### One-time setup

From the **SigntifyKurt** folder:

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

After deployment, deleting a user in Admin Dashboard → User Management will fully remove the account (Auth + Firestore).
