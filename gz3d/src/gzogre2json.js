/**
 * Converts an Ogre material script into JSON
 * @constructor
 */
GZ3D.Ogre2Json = function () {
  this.emitter =
    globalEmitter || new EventEmitter2({ verboseMemoryLeak: true });

  // Keeps the whole material file as an Object
  this.materialObj = [];

  // Keeps all materials in the format needed by GZ3D.SdfParser
  this.materials = {};
};

/**
 * Load materials from a .material file
 * @param _url Full URL to .material file
 * @returns A promise where:
 *          * resolve: returns a boolean indicating success
 *          * reject: returns the HTTP status text
 */
GZ3D.Ogre2Json.prototype.LoadFromUrl = function (_url) {
  const fileLoader = new THREE.FileLoader();
  const xhr = fileLoader.load(_url, function () {});

  // TODO: remove this when whole code has been migrated to ES6
  return new Promise((resolve, reject) => {
    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve(this.Parse(xhr.responseText));
      } else {
        reject(xhr.statusText);
      }
    };
  });
};

/**
 * Parse material script and store it into this.materials
 * @param _str Material script as a string.
 */
GZ3D.Ogre2Json.prototype.Parse = function (_str) {
  let str = _str;

  // { and } in new lines
  str = str.replace(/{|}/gm, "\r\n$&\r\n");

  // Remove leading and trailing whitespaces per line
  str = str.replace(/^\s+/gm, "");
  str = str.replace(/\s+$/gm, "");

  // Remove material alias (material Name : AnotherName {})
  str = str.replace(/^material (.*):(.*)$/gm, function (match, p1, p2) {
    return "material " + p1;
  });

  // Remove "material " and properly add commas if more than one
  str = str.replace(/^material /gm, function (match, offset) {
    return offset === 0 ? "" : "},{";
  });

  // Handle vertex and fragment programs
  str = str.replace(
    /^vertex_program .*$|^fragment_program .*$/gm,
    function (match, offset) {
      const underscores = match.replace(/ /g, "_");
      return offset === 0 ? underscores : "},{" + underscores;
    }
  );

  // Ignore import lines
  str = str.replace(/^import .*$/gm, "");

  // Handle vertex and fragment programs refs
  str = str.replace(
    /^vertex_program_ref.*$|^fragment_program_ref.*$/gm,
    function (match, offset) {
      return match.replace(/ /g, "_");
    }
  );

  // Strip name from named texture_unit
  str = str.replace(/^texture_unit.*$/gm, function (match, offset) {
    return "texture_unit";
  });

  // Strip name from named pass
  str = str.replace(/^pass.*$/gm, function (match, offset) {
    return "pass";
  });

  // Strip name from named technique
  str = str.replace(/^technique.*$/gm, function (match, offset) {
    return "technique";
  });

  // Remove comments
  str = str.replace(/(\/\*[\s\S]*?\*\/)|(\/\/.*$)/gm, "");

  // Remove leading and trailing whitespaces per line (again)
  str = str.replace(/^\s+/gm, "");
  str = str.replace(/\s+$/gm, "");

  // Remove double-quotes
  str = str.replace(/"/gm, "");

  // If line has more than one space, it has an array
  str = str.replace(/(.* .*){2,}/g, function (match) {
    const parts = match.split(/\s+/g);

    let res = parts[0] + " [";
    for (let i = 1; i < parts.length - 1; i++) {
      res += parts[i] + ",";
    }
    res += parts[parts.length - 1] + "]";

    return res;
  });

  // Add comma to end of lines that have space
  str = str.replace(/(.* .*)/g, "$&,");

  // Remove new lines
  str = str.replace(/\r?\n|\r/g, "");

  // Add key-value separators
  str = str.replace(/\s/g, ": ");
  str = str.replace(/{/g, function (match, offset, full) {
    // Don't add if preceeded by comma
    return full[offset - 1] === "," ? "{" : ": {";
  });

  // Add surrounding brackets
  str = "[{" + str + "}]";

  // Wrap keys and values with double quotes
  str = str.replace(/([\w/\.]+)/g, '"$&"');

  // Remove comma from last property in a sequence
  str = str.replace(/,}/g, "}");

  // Add comma between sibling objects
  str = str.replace(/}"/g, '},"');

  // Parse JSON
  try {
    this.materialObj = JSON.parse(str);
  } catch (e) {
    console.error("Failed to parse JSON. Original string:");
    console.error(_str);
    console.error("Modified string:");
    console.error(str);
    return false;
  }

  // Arrange materials array so that GZ3D.SdfParser can consume it
  for (const material in this.materialObj) {
    for (const matName in this.materialObj[material]) {
      const matValue = this.materialObj[material][matName];

      if (typeof matValue !== "object") {
        console.error("Failed to parse material [" + matName + "]");
        continue;
      }

      this.materials[matName] = {};

      // Ambient
      const ambient = _.get(
        this.materialObj[material],
        matName + ".technique.pass.ambient"
      );
      if (ambient !== undefined && Array.isArray(ambient)) {
        this.materials[matName].ambient = ambient.map(Number);
      }

      // Diffuse
      const diffuse = _.get(
        this.materialObj[material],
        matName + ".technique.pass.diffuse"
      );
      if (diffuse !== undefined && Array.isArray(diffuse)) {
        this.materials[matName].diffuse = diffuse.map(Number);
      }

      // Specular
      const specular = _.get(
        this.materialObj[material],
        matName + ".technique.pass.specular"
      );
      if (specular !== undefined && Array.isArray(specular)) {
        this.materials[matName].specular = specular.map(Number);
      }

      // Emissive
      const emissive = _.get(
        this.materialObj[material],
        matName + ".technique.pass.emissive"
      );
      if (emissive !== undefined && Array.isArray(emissive)) {
        this.materials[matName].emissive = emissive.map(Number);
      }

      // Depth write
      const depthWrite = _.get(
        this.materialObj[material],
        matName + ".technique.pass.depth_write"
      );
      if (depthWrite !== undefined) {
        this.materials[matName].depth_write = depthWrite !== "off";
      }

      // Depth check
      const depthCheck = _.get(
        this.materialObj[material],
        matName + ".technique.pass.depth_check"
      );
      if (depthCheck !== undefined) {
        this.materials[matName].depth_check = depthCheck !== "off";
      }

      // Texture
      const texture = _.get(
        this.materialObj[material],
        matName + ".technique.pass.texture_unit.texture"
      );
      if (texture !== undefined) {
        this.materials[matName].texture = texture;
      }

      // Scale
      const scale = _.get(
        this.materialObj[material],
        matName + ".technique.pass.texture_unit.scale"
      );
      if (scale !== undefined && Array.isArray(scale)) {
        this.materials[matName].scale = scale.map(Number);
      }

      // Opacity
      const alphaOpEx = _.get(
        this.materialObj[material],
        matName + ".technique.pass.texture_unit.alpha_op_ex"
      );
      if (
        alphaOpEx !== undefined &&
        Array.isArray(alphaOpEx) &&
        alphaOpEx.length === 4
      ) {
        this.materials[matName].opacity = Number(alphaOpEx[3]);
      }
    }
  }

  // Notify others
  this.emitter.emit("material", this.materials);
  return true;
};
