function getMainLine(src) {
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].indexOf('main()') !== -1) return i;
  }
  return -1;
}

export default function ISFLineMapper(error, glsl, isf) {
  const glslMainLine = getMainLine(glsl);
  const isfMainLine = getMainLine(isf);
  const regex = /ERROR: (\d+):(\d+): (.*)/g;
  const matches = regex.exec(error.message);
  const glslErrorLine = matches[2];
  const isfErrorLine = parseInt(glslErrorLine, 10) + isfMainLine - glslMainLine;
  return isfErrorLine;
}

/**
 * Converts the error-linenumbers from the parsed ISF code into the ones
 * from the original file, so that they actually can be used by the end user
 *
 * @param {String} error - The actual error
 * @param {String} glsl - The parsed ISF code
 * @param {String} isf - The raw ISF code
 * @returns String - The error with the corrected lines
 */
export function correctedLineErrors(error, glsl, isf) {
  const offset = getMainLine(isf) - getMainLine(glsl);
  return error.replace(/(?:WARNING|ERROR): \d+:(\d+): .*/g, (match, isfLinenumber) => {
    return match.replace(isfLinenumber, parseInt(isfLinenumber, 10) + offset);
  });
}
