const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/hyvemail').then(async () => {
  const col = mongoose.connection.collection('emailaccounts');
  const acc = await col.findOne({email:'tlon@hyvechain.com'});
  console.log('socialUserId:', acc?.socialUserId || 'NOT SET');
  console.log('socialUsername:', acc?.socialUsername || 'NOT SET');
  process.exit();
});
