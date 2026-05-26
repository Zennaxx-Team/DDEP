function safeJSONStringify(data, limitBytes) {
  const safeLimit = Number(limitBytes); // ensure number
  let result = "";

  try {
    const dataString = JSON.stringify(data);
    const dataSize = Buffer.byteLength(dataString, 'utf8');

    if (dataSize <= safeLimit) {
      result = dataString; // keep stringified version
    } else {
      result = JSON.stringify({ "message": "Large Volumn Json cannot be shown" })
    }
  } catch (err) {
    console.error("Error stringifying data:", err);
    return data;
  }

  return result;
}

function safeJSONWithOutStringify(data, limitBytes) {
  const safeLimit = Number(limitBytes); // ensure number
  let result = "";

  try {
    const dataString = JSON.stringify(data);
    const dataSize = Buffer.byteLength(dataString, 'utf8');

    if (dataSize <= safeLimit) {
      result = data;
    } else {
      result = JSON.stringify({ "message": "Large Volumn Json cannot be shown" })
    }
  } catch (err) {
    console.error("Error stringifying data:", err);
    return data;
  }

  return result;
}

module.exports = { safeJSONStringify, safeJSONWithOutStringify }