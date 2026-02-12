const { Pool } = require('pg');
const p = new Pool({user:'hyve_admin',password:'JEsus$20252026',database:'hyve_social',host:'localhost'});
p.query("SELECT wallet_address, email FROM users WHERE email IS NOT NULL").then(r=>{
  console.log(JSON.stringify(r.rows, null, 2));
  p.end();
}).catch(e => { console.error(e.message); p.end(); });
