import { parse } from 'yaml';

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

const { hasOwn, keys } = Object;

const { stringify } = JSON;
// const stringify = (what, how = null) => JSON.stringify(what, how, '  ');

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
      let target = json, keys = key.split('.'), last = keys.length - 1;
      // avoid thing1.2etc to throw
      while (/^\d/.test(keys[last])) {
        last--;
        keys[last] += `.${keys[last + 1]}`;
      }
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

// cleanup company_identifiers
const { company_identifiers } = json.assigned_numbers;
reduce(company_identifiers, 'company_identifiers');
delete json.assigned_numbers.company_identifiers;

for (const key of keys(json.assigned_numbers.core)) {
  const value = json.assigned_numbers.core[key];
  const nested = keys(value);
  if (nested.length === 1 && nested[0] === key)
    json.assigned_numbers.core[key] = value[key];
}

for (const key of keys(json.assigned_numbers.uuids)) {
  const value = json.assigned_numbers.uuids[key];
  const nested = keys(value);
  if (nested.length === 1 && nested[0] === 'uuids')
    json.assigned_numbers.uuids[key] = value.uuids;
}

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

const identifiers = [];

const cleanup = (k, v) => {
  if (k === 'description') return;
  if (typeof v === 'string') {
    if (/^\d+$/.test(v) || /^0x[0-9A-F]+$/.test(v))
      return Number(v);
    if (/^org\.bluetooth\.([^.]+?)\./.test(v)) {
      const { $1: name } = RegExp;
      if (name === 'characteristic') return;
      let index = identifiers.indexOf(name);
      if (index < 0) index = identifiers.push(name) - 1;
      return [index, v.replace(`org.bluetooth.${name}.`, '')];
    }
  }
  return v;
};

json['org.bluetooth'] = identifiers;

writeFileSync(join('.', 'bt.json'), stringify(json, cleanup));
