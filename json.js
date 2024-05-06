import { parse } from 'yaml';

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

const { hasOwn, keys } = Object;
const { stringify } = JSON;

const convert = (source, dest, json) => {
  for (const file of readdirSync(source)) {
    if (file.startsWith('.')) continue;
    const sourcePath = join(source, file);
    const destPath = join(dest, file);
    const key = file.replace(/^org\.bluetooth\.|\.yaml$/g, '');
    if (statSync(sourcePath).isDirectory()) {
      mkdirSync(destPath, { recursive: true });
      convert(sourcePath, destPath, json[key] = {});
    }
    else if (sourcePath.endsWith('.yaml')) {
      const value = parse(readFileSync(sourcePath).toString());
      const keys = key.split('.'), last = keys.length - 1;
      let target = json;
      for (let k, i = 0; i < last; i++) {
        k = keys[i];
        if (!hasOwn(target, k)) target[k] = {};
        target = target[k];
      }
      writeFileSync(
        destPath.replace(/\.yaml$/, '.json'),
        stringify(target[keys[last]] = value)
      );
    }
  }
  return json;
};

const json = convert(join('.', 'public'), join('.', 'json'), {});

const reduce = (json, name) => {
  for (const key of keys(json)) {
    const { [name]: value } = json[key];
    json[key] = value;
  }
};

// cleanup assigned_numbers
const { company_identifiers } = json.assigned_numbers;
reduce(company_identifiers, 'company_identifiers');
json.assigned_numbers = company_identifiers.company_identifiers;

// cleanup dp
json.dp.properties = json.dp.properties.property;
reduce(json.dp.properties, 'property');

const { groups } = json.dp.property_groups;
delete json.dp.property_groups;
json.dp.groups = groups;

const { propertyids: ids } = json.dp.property_ids;
delete json.dp.property_ids;
json.dp.ids = ids;

// cleanup gss
json.gss = json.gss.characteristic;
reduce(json.gss, 'characteristic');

writeFileSync(join('.', 'bt.json'), stringify(json));
