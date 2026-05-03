/* eslint-disable */
const fs = require('fs');
const path = require('path');

function set(obj, path, value) {
  if (Object(obj) !== obj) return obj; // When obj is not an object
  // If not a string, pass it down
  if (!Array.isArray(path)) path = path.toString().match(/[^.[\]]+/g) || []; 
  path.slice(0, -1).reduce((a, c, i) => // Iterate all of them except the last one
    Object(a[c]) === a[c] ? // Does the key exist and is its value an object?
      a[c] : // Yes: then follow that path
      a[c] = Math.abs(path[i + 1]) >> 0 === +path[i + 1] ? [] : {}, // No: create the key
    obj)[path[path.length - 1]] = value; // Finally assign the value to the last key
  return obj; // Return the top-level object
}

function unflatten(data) {
  if (typeof data !== 'object' || data === null) return data;
  
  const result = {};
  for (const [key, value] of Object.entries(data)) {
    // If value is an object (not array), unflatten it recursively first
    let processedValue = value;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      processedValue = unflatten(value);
    }
    set(result, key, processedValue);
  }
  return result;
}

const localesDir = path.join(__dirname, 'src', 'i18n', 'messages');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

for (const file of files) {
  const filePath = path.join(localesDir, file);
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const fixed = unflatten(data);
    fs.writeFileSync(filePath, JSON.stringify(fixed, null, 2));
    console.log(`Fixed ${file}`);
  } catch (err) {
    console.error(`Error fixing ${file}:`, err);
  }
}
