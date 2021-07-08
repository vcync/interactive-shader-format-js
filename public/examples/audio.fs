/*
{
  "CATEGORIES" : [
    "Generator"
  ],
  "DESCRIPTION" : "Visualizes an audio waveform image",
  "INPUTS" : [
    {
      "NAME" : "waveImage",
      "TYPE" : "audio"
    },
    {
      "NAME" : "waveSize",
      "TYPE" : "float",
      "MAX" : 1.0,
      "DEFAULT" : 1.0,
      "MIN" : 0
    }
  ],
  "CREDIT" : "by VIDVOX"
}
*/

void main() {
  // get the location of this pixel
  vec2  loc = isf_FragNormCoord;

  // though not needed here, note the IMG_SIZE function can be used to get the dimensions of the audio image
  //vec2    audioImgSize = IMG_SIZE(waveImage);

  vec2  waveLocL = vec2(loc.x, 0.0);
  vec2  waveLocR = vec2(loc.x, 1.0);
  vec4  waveL = IMG_NORM_PIXEL(waveImage, waveLocL);
  vec4  waveR = IMG_NORM_PIXEL(waveImage, waveLocR);
  vec4  waveAdd = vec4(
    // left channel in red
    1.0 - smoothstep(0.0, 0.01, abs(waveL - loc.y)).x,
    0.0,
    // right channel in blue
    1.0 - smoothstep(0.0, 0.01, abs(waveR - loc.y)).x,
    1.0
  );

  gl_FragColor = waveAdd;
}