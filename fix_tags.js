const fs = require('fs');
const path = 'C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx';
let c = fs.readFileSync(path, 'utf8');

c = c.replace(/\\n                                        <\/div>\\n                                    <\/TabsContent>/g, 
`
                                            )}
                                        </div>
                                    </TabsContent>`);

fs.writeFileSync(path, c);
console.log('Fixed tags exactly using Regex script');
