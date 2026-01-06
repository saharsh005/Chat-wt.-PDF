import { Clerk } from '@clerk/clerk-sdk-node';

const clerk = Clerk({ secretKey: process.env.CLERK_SECRET_KEY });

export const clerkAuth = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  try {
    const claims = await clerk.verifyToken(token);
    req.user = {
      id: claims.sub,        // Clerk user ID
      email: claims.email_addresses[0].email_address,
      name: claims.full_name
    };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
