import { Renderer as ISFRenderer } from "./main.js";

let video = null;
const renderers = (window.renderers = []);

async function loadFile(src) {
  const response = await fetch("assets/examples/" + src);
  const body = await response.text();

  return body;
}

async function createRendering(fsFilename, vsFilename, label) {
  const fsSrc = await loadFile(fsFilename);
  const vsSrc = vsFilename ? await loadFile(vsFilename) : false;

  const container = document.createElement("div");
  const canvas = document.createElement("canvas");
  const title = document.createElement("div");

  title.style.position = "absolute";
  title.style.top = "0";
  title.style.color = "white";
  title.style.left = "0";

  container.style.position = "relative";
  container.appendChild(canvas);
  container.appendChild(title);

  title.textContent = fsFilename;

  if (label) {
    title.textContent += "(" + label + ")";
  }

  canvas.width = window.innerWidth / 2;
  canvas.height = window.innerHeight / 2;
  document.body.appendChild(container);

  // Using webgl2 for non-power-of-two textures
  const gl = canvas.getContext("webgl2");
  const renderer = new ISFRenderer(gl);
  renderer.loadSource(fsSrc, vsSrc);

  const animate = () => {
    requestAnimationFrame(animate);

    // tapestryfract doesn't have inputImage so we'll need to check
    if ("inputImage" in renderer.uniforms) {
      renderer.setValue("inputImage", video);
    }

    renderer.draw(canvas);
  };

  requestAnimationFrame(animate);
  return renderer;
}

(async () => {
  const webcamButton = document.createElement("button");
  webcamButton.textContent = "Start webcam";
  document.body.appendChild(webcamButton);

  const audioButton = document.createElement("button");
  audioButton.textContent = "Resume audioContext";
  document.body.appendChild(audioButton);
  audioButton.addEventListener("click", () => {
    renderers.forEach((renderer) => {
      renderer.audio.audioContext.resume();
    });
  });

  renderers.push(await createRendering("tapestryfract.fs"));
  renderers.push(await createRendering("audio.fs"));
  renderers.push(await createRendering("audio-fft.fs"));
  renderers.push(await createRendering("audio-32-samples.fs"));
  renderers.push(await createRendering("audio-fft-32-samples.fs"));

  webcamButton.addEventListener("click", async () => {
    video = document.createElement("video");
    video.autoplay = true;

    navigator.mediaDevices
      .getUserMedia({
        video: true,
      })
      .then(function (stream) {
        video.srcObject = stream;
      });

    renderers.push(await createRendering("badtv.fs", undefined, "Simple"));
    renderers.push(
      await createRendering("feedback.fs", undefined, "Has target on last pass")
    );
    renderers.push(
      createRendering(
        "rgbtimeglitch.fs",
        undefined,
        "Has lots of buffers and passes"
      )
    );
    renderers.push(
      createRendering("rgbglitchmod.fs", undefined, "Has target on last pass")
    );
    renderers.push(
      createRendering("edges.fs", "edges.vs", "Has custom vertex shader")
    );
  });
})();
