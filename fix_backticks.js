const fs = require('fs');
let c = fs.readFileSync('C:/project/VITOGRAPH/perfect_render_block.txt', 'utf8');
c = c.replace(/\\\`/g, '\`');
c = c.replace(/\\\$/g, '$');
fs.writeFileSync('C:/project/VITOGRAPH/perfect_render_block.txt', c);
console.log('Fixed backticks.');
