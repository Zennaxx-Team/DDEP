const { FunctionPlugin, FunctionArgumentType } = require("hyperformula");

class MyCustomPlugin extends FunctionPlugin {
  null(ast, state) {
    return this.runFunction(ast.args, state, this.metadata("NULL"), () => {
      return null;
    });
  }

  toJson(ast, state) {
    function cleanObjectStrings(obj) {
      if (Array.isArray(obj)) {
        return obj.map(cleanObjectStrings);
      } else if (typeof obj === 'object' && obj !== null) {
        return Object.fromEntries(
          Object.entries(obj).map(([key, value]) => {
            if (typeof value === 'string') {
              return [key, value.replace(/^"(.*)"$/, '$1')];
            } else if (typeof value === 'object') {
              return [key, cleanObjectStrings(value)];
            }
            return [key, value];
          })
        );
      }
      return obj;
    }

    return this.runFunction(ast.args, state, this.metadata('TOJSON'), (input) => {
      try {
        if (input === null || input === undefined || input === '') return { toJson: null };
        if (typeof input === 'object') return { toJson: input };

        if (typeof input === 'string') {
          let str = input.trim();


          // Replace escaped quotes and backslashes
          str = str.replace(/\\"/g, '"').replace(/\\\\/g, '\\');

          console.log(str,"str after");

          // Try parsing top-level JSON only
          try {
            const parsed = JSON.parse(str);
            return { toJson: cleanObjectStrings(parsed) };
          } catch (err) {
            const parsed2 = JSON.parse(input);
            console.log(parsed2,"parsed2");
            // fallback: return as string if not valid JSON
            return { toJson: parsed2 };
          }
        }

        return { toJson: input };
      } catch (e) {
        console.error('toJson parse error:', e);
        return { toJson: input };
      }
    });
  }

  jsonToBody(ast, state) {
    return this.runFunction(ast.args, state, this.metadata('JSONTOBODY'), (input) => {
      try {
        let parsed;
        input = this.replaceToJson(input);
        if (typeof input === 'string') {
          parsed = JSON.parse(input);
        } else if (typeof input === 'object' && input !== null) {
          parsed = input; // Already an object
        } else {
          return input; // Can't process
        }

        let mailContent = '';
        try {
          if (parsed && typeof parsed === 'object') {
            const jsonString = JSON.stringify(parsed, null, 4);
            const formattedJsonString1 = this.formatJsonWithLineNumbers(jsonString);

            mailContent += `<table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%; text-align: left; margin-top:30px">`;
            mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:0px; border: 1px solid #ddd;"><table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%; border-collapse: collapse;"><tbody>${formattedJsonString1}</tbody></table></td></tr>`;
            mailContent += `</table>`;
          }
        } catch (error) {
          console.error('Error generating HTML table:', error);
        }
        return mailContent;
      } catch (e) {
        console.error('error:', e);
        if (typeof input === 'object') {
          return JSON.stringify(input);
        }
        return input;
      }
    });
  }

  replaceToJson(obj) {
    if (Array.isArray(obj)) {
      return obj.map(item => this.replaceToJson(item));
    } else if (obj !== null && typeof obj === 'object') {
      if ('toJson' in obj) {
        return this.replaceToJson(obj['toJson']); // Replace with toJson content
      } else {
        const newObj = {};
        for (const [key, value] of Object.entries(obj)) {
          newObj[key] = this.replaceToJson(value);
        }
        return newObj;
      }
    } else {
      return obj; // Primitive values
    }
  }

  jsonToBodyTable(ast, state) {
    return this.runFunction(ast.args, state, this.metadata('JSONTOBODYTABLE'), (input) => {
      try {
        let parsed;
        input = this.replaceToJson(input);
        if (typeof input === 'string') {
          parsed = JSON.parse(input);
        } else if (typeof input === 'object' && input !== null) {
          parsed = input; // Already an object
        } else {
          return input; // Can't process
        }

        let tableHtml = '';
        let mailContent = '';
        try {
          if (parsed && typeof parsed === 'object') {
            tableHtml = this.jsonToDynamicTable(parsed, {
              maxDepth: 100,
              tableStyle: 'width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;',
              headerStyle: 'font-weight: bold; padding: 8px; border: 1px solid #ddd;',
              cellStyle: 'padding: 8px; border: 1px solid #ddd; vertical-align: top;',
              keyCellStyle: 'width: 30%; background-color: #f5f5f5; font-weight: bold;'
            });
          } else {
            tableHtml =
              `<table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${this.formatPrimitiveValue(parsed)}</td>
              </tr>
            </table>`;
          }

          mailContent += `<table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%; text-align: left; margin-top:30px">`;
          mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:0px; border: 1px solid #ddd; border-bottom: none;">${tableHtml}</td></tr>`;
          mailContent += `</table>`;

        } catch (error) {
          console.error('Error generating HTML table:', error);
        }

        return mailContent;
      } catch (e) {
        console.error('error:', e);
        return input;
      }
    });
  }

  toJson2(ast, state) {
    const safeJsonParse = (str) => {
      if (str === null || str === undefined) return str;
      if (typeof str !== 'string') return str;

      let cleanStr = str.trim();

      // Remove surrounding quotes
      if (cleanStr.length > 1 &&
        ((cleanStr.startsWith('"') && cleanStr.endsWith('"')) ||
          (cleanStr.startsWith("'") && cleanStr.endsWith("'")))) {
        cleanStr = cleanStr.substring(1, cleanStr.length - 1).trim();
      }

      // Try normal JSON parse
      try {
        return JSON.parse(cleanStr);
      } catch (e1) {
        // Try unescaping \" and \\
        try {
          const unescaped = cleanStr.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          return JSON.parse(unescaped);
        } catch (e2) {
          // If it looks like array/object, try single → double quotes fix
          if ((cleanStr.startsWith('[') && cleanStr.endsWith(']')) ||
            (cleanStr.startsWith('{') && cleanStr.endsWith('}'))) {
            try {
              const fixed = cleanStr
                .replace(/'/g, '"')       // single → double quotes
                .replace(/,\s*]/g, ']')  // remove trailing commas in arrays
                .replace(/,\s*}/g, '}'); // remove trailing commas in objects
              return JSON.parse(fixed);
            } catch (e3) {
              console.error("safeJsonParse failed:", e3.message);
              return str; // fallback: return original
            }
          } else {
            // Not array/object, return original string
            return str;
          }
        }
      }
    };


    return this.runFunction(ast.args, state, this.metadata('TOJSON2'), (input) => {
      try {
        if (input === null || input === undefined || input === '') return { toJson: null };
        if (typeof input === 'object') return { toJson: input };

        if (typeof input === 'string') {
          console.log("Input string length:", input.length);
          console.log("First 100 chars:", input.substring(0, 100));
          const parsed = safeJsonParse(input);
          console.log("Parsed type:", typeof parsed);
          console.log("Parsed result:", parsed);
          return { toJson: parsed };
        }

        return { toJson: input };
      } catch (e) {
        console.error("toJson error:", e);
        return { toJson: input };
      }
    });
  }

  stringEncode(ast, state) {
    return this.runFunction(ast.args, state, this.metadata('STRINGENCODE'), (input) => {

      if (input == null) return '';

      let str;

      if (typeof input === 'object') {
        try {
          str = JSON.stringify(input);
        } catch {
          str = String(input);
        }
      }
      else if (typeof input === 'string') {
        let cleaned = this.cleanString(input);

        // Try to detect escaped JSON and unescape it
        try {
          // If looks like JSON but escaped
          if (/^\\?{/.test(cleaned) || cleaned.includes('\\"')) {
            const parsed = JSON.parse(cleaned.replace(/\\"/g, '"'));
            str = JSON.stringify(parsed);
          } else {
            str = cleaned;
          }
        } catch {
          str = cleaned;
        }
      }
      else {
        str = String(input);
      }

      return `"${str}"`;
    });
  }

  formatJsonWithLineNumbers(jsonString) {
    const lines = jsonString.split('\n');
    let formattedString = '';

    lines.forEach((line, index) => {
      // Only border after line number column and fixed 50px width
      formattedString +=
        `<tr style="line-height: 1.5;">` +
        `<td style="width: 50px; color: #666; font-size: 14px; font-family: Courier, monospace; padding:2px 8px; text-align: left; vertical-align: top; border: none; border-right: 1px solid #ddd;">${index + 1}</td>` +
        `<td style="font-family: Courier, monospace; font-size: 14px; padding:2px 8px; vertical-align: top; border: none;">${line.replace(/ /g, '&nbsp;')}</td>` +
        `</tr>`;
    });

    return formattedString;
  }

  jsonToDynamicTable(data, options = {}) {
    const defaultOptions = {
      tableStyle: 'width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;',
      headerStyle: 'font-weight: bold; text-align: left; padding: 8px; border: 1px solid #ddd;',
      cellStyle: 'padding: 8px; border: 1px solid #ddd; vertical-align: top;',
      keyCellStyle: 'width: 30%;',
      maxDepth: 100,
      currentDepth: 0,
      parentKey: ''
    };

    const config = { ...defaultOptions, ...options };

    if (config.currentDepth >= config.maxDepth) {
      return `<span style="color: #666; font-style: italic;">
						[Deeply nested data - ${config.parentKey}]
				</span>`;
    }

    // Handle primitive values
    if (data === null || data === undefined || typeof data !== 'object') {
      return `<td colspan="2" style="${config.cellStyle}">${this.formatPrimitiveValue(data)}</td>`;
    }

    // Handle arrays
    if (Array.isArray(data)) {
      if (data.length === 0) {
        return `<td colspan="2" style="${config.cellStyle}">[]</td>`;
      }

      let html = `<table style="${config.tableStyle}">`;

      const isObjectArray = data.some(item => typeof item === 'object' && item !== null);

      if (isObjectArray) {
        const allKeys = [...new Set(data.flatMap(item =>
          item ? Object.keys(item) : []
        ))];

        // Header row
        html += `<tr>`;
        allKeys.forEach(key => {
          html += `<th style="${config.headerStyle}">${key}</th>`;
        });
        html += `</tr>`;

        // Data rows
        data.forEach((item, index) => {
          html += `<tr>`;
          if (!item) {
            html += `<td style="${config.cellStyle}" colspan="${allKeys.length}">null or undefined</td>`;
          } else {
            allKeys.forEach(key => {
              const value = item[key];
              html += `<td style="${config.cellStyle}">`;
              if (typeof value === 'object' && value !== null) {
                html += this.jsonToDynamicTable(value, {
                  ...config,
                  currentDepth: config.currentDepth + 1,
                  parentKey: key
                });
              } else {
                html += this.formatPrimitiveValue(value);
              }
              html += `</td>`;
            });
          }
          html += `</tr>`;
        });
      } else {
        // Simple array of primitives
        html += `<tr><th style="${config.headerStyle}">Index</th><th style="${config.headerStyle}">Value</th></tr>`;
        data.forEach((item, index) => {
          html += `<tr>
							<td style="${config.cellStyle}">${index}</td>
							<td style="${config.cellStyle}">${this.formatPrimitiveValue(item)}</td>
						</tr>`;
        });
      }

      html += `</table>`;
      return html;
    }

    // Handle objects
    let html = `<table style="${config.tableStyle}">`;

    for (const [key, value] of Object.entries(data)) {
      html += `<tr>
					<td style="${config.cellStyle} ${config.keyCellStyle}">${key}</td>
					<td style="${config.cellStyle}">`;

      if (typeof value === 'object' && value !== null) {
        html += this.jsonToDynamicTable(value, {
          ...config,
          currentDepth: config.currentDepth + 1,
          parentKey: key
        });
      } else {
        html += this.formatPrimitiveValue(value);
      }

      html += `</td></tr>`;
    }

    html += `</table>`;
    return html;
  }

  formatPrimitiveValue(value) {
    if (value === null) return '<span>null</span>';
    if (value === undefined) return '<span>undefined</span>';
    if (value === '') return '<span></span>';
    if (typeof value === 'boolean') return value ? '<span>true</span>' : '<span>false</span>';
    if (typeof value === 'number') return `<span>${value}</span>`;
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        return `<span>${value}</span>`;
      }
      return value;
    }
    return value;
  }

  // Helper to clean string input
  cleanString(str) {
    if (typeof str !== 'string') return str;
    let s = str.trim();

    if (s.startsWith('=')) s = s.slice(1);
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      s = s.slice(1, -1);
    }

    // Remove Excel-style double quotes
    s = s.replace(/""/g, '"');

    // Unescape backslashes before quotes (\")
    s = s.replace(/\\"/g, '"');

    return s;
  }

  JSON_STRINGIFY(ast, state) {
    return this.runFunction(ast.args, state, this.metadata('JSON_STRINGIFY'), (input) => {
      if (input == null) return 'null';

      try {
        // If input is a string that looks like JSON, parse first
        if (typeof input === 'string') {
          let cleaned = this.cleanString(input);
          try {
            input = JSON.parse(cleaned);
          } catch (err) {
            // Keep as string if not valid JSON

          }
        }
        return JSON.stringify(input);
      } catch (e) {
        return `#ERROR: ${e.message}`;
      }
    });
  }

  JSON_PARSE(ast, state) {
    return this.runFunction(ast.args, state, this.metadata('JSON_PARSE'), (input) => {
      if (typeof input !== 'string') return input;

      let cleaned = this.cleanString(input);

      try {
        return JSON.parse(cleaned);
      } catch {
        // Fallback: try unescaping quotes
        try {
          const fixed = cleaned.replace(/\\"/g, '"');
          return JSON.parse(fixed);
        } catch {
          return `#ERROR: Invalid JSON`;
        }
      }
    });
  }

  BASE64ENCODE(ast, state) {
    return this.runFunction(ast.args, state, this.metadata('BASE64ENCODE'), (input) => {
      if (input == null) return '';
      let str = '';

      if (typeof input === 'object') {
        try {
          str = JSON.stringify(input);
        } catch {
          str = String(input);
        }
      } else {
        str = String(input);
      }

      return Buffer.from(str, 'utf-8').toString('base64');
    });
  }

  BASE64DECODE(ast, state) {
    return this.runFunction(ast.args, state, this.metadata('BASE64DECODE'), (input) => {
      if (typeof input !== 'string') return input;

      try {
        return `${Buffer.from(input, 'base64').toString('utf-8')}`;
      } catch {
        return `#ERROR: Invalid Base64`;
      }
    });
  }
}

MyCustomPlugin.implementedFunctions = {
  NULL: {
    method: "null",
    parameters: []
  },
  TOJSON: {
    method: "toJson",
    parameters: [
      {
        argumentType: FunctionArgumentType.ANY
      }
    ]
  },
  TOJSON2: {
    method: "toJson2",
    parameters: [
      {
        argumentType: FunctionArgumentType.ANY
      }
    ]
  },
  JSONTOBODY: {
    method: "jsonToBody",
    parameters: [
      { argumentType: FunctionArgumentType.ANY }
    ]
  },
  JSONTOBODYTABLE: {
    method: "jsonToBodyTable",
    parameters: [
      { argumentType: FunctionArgumentType.ANY }
    ]
  },
  STRINGENCODE: {
    method: "stringEncode",
    parameters: [
      { argumentType: FunctionArgumentType.ANY }
    ]
  },
  stringEncode: { method: "stringEncode", parameters: [{ argumentType: FunctionArgumentType.ANY }] },
  JSON_STRINGIFY: { method: "JSON_STRINGIFY", parameters: [{ argumentType: FunctionArgumentType.ANY }] },
  JSON_PARSE: { method: "JSON_PARSE", parameters: [{ argumentType: FunctionArgumentType.STRING }] },
  BASE64ENCODE: {
    method: "BASE64ENCODE",
    parameters: [{ argumentType: FunctionArgumentType.ANY }]
  },
  BASE64DECODE: {
    method: "BASE64DECODE",
    parameters: [{ argumentType: FunctionArgumentType.STRING }]
  }
};

const MyCustomPluginTranslations = {
  enGB: {
    NULL: "NULL",
    TOJSON: 'TOJSON',
    TOJSON2: 'TOJSON2',
    JSONTOBODY: 'JSONTOBODY',
    JSONTOBODYTABLE: 'JSONTOBODYTABLE',
    STRINGENCODE: 'STRINGENCODE',
    JSON_STRINGIFY: 'JSON_STRINGIFY',
    JSON_PARSE: "JSON_PARSE",
    BASE64ENCODE: 'BASE64ENCODE',
    BASE64DECODE: 'BASE64DECODE'
  },
  enUS: {
    NULL: "NULL",
    TOJSON: 'TOJSON',
    JSONTOBODY: 'JSONTOBODY',
    JSONTOBODYTABLE: 'JSONTOBODYTABLE',
    TOJSON2: 'TOJSON2',
    STRINGENCODE: 'STRINGENCODE',
    JSON_STRINGIFY: 'JSON_STRINGIFY',
    JSON_PARSE: "JSON_PARSE",
    BASE64ENCODE: 'BASE64ENCODE',
    BASE64DECODE: 'BASE64DECODE'
  }
};

module.exports = {
  MyCustomPlugin,
  MyCustomPluginTranslations
};