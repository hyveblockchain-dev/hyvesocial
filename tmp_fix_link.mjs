import mongoose from 'mongoose';
await mongoose.connect('mongodb://127.0.0.1:27017/hyvemail');
const r = await mongoose.connection.collection('emailaccounts').updateOne(
  { email: 'tlon@hyvechain.com' },
  { $set: { socialUserId: '0x3985b1dbfa132b0a0acb79183c872e46d38c2301', socialUsername: 'TLON' } }
);
console.log('Modified:', r.modifiedCount);
// Verify
const acc = await mongoose.connection.collection('emailaccounts').findOne({ email: 'tlon@hyvechain.com' });
console.log('socialUserId:', acc.socialUserId);
console.log('socialUsername:', acc.socialUsername);
process.exit();
