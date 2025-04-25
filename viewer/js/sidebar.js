const material = {
  name: "Material",
  baseColor: "#ffffff",
  alpha: 1,
  alphaCutoff: 0,
  tiling: 1,
  baseMap: "none",
  normalMap: "none",
  metalnessMap: "none",
  metalness: 0,
  roughnessMap: "none",
  roughness: 0.5,
  aoMap: "none",
  scale: 0.02,
  emission: "#000000",
  emissionIntensity: 1,
  emissiveMap: "none",

  clearBaseMap: () => material.baseMap = "none",
  clearNormalMap: () => material.normalMap = "none",
  clearMetalnessMap: () => material.metalnessMap = "none",
  clearRoughnessMap: () => material.roughnessMap = "none",
  clearAoMap: () => material.aoMap = "none",
  clearEmissiveMap: () => material.emissiveMap = "none"
};

const controlKit = new ControlKit({
  container: document.body
});

const panel = controlKit.addPanel({
  label: 'Material - Metalllic Roughness',
  width: 240,
  align: 'left',  // Panel nằm bên trái
  fixed: false    // Cho phép kéo di chuyển
});

panel
  .addGroup({ label: 'Main' })

  .addStringInput(material, 'name', { label: 'Name' })
  .addColor(material, 'baseColor', { label: 'Base Color' })

  .addSlider(material, 'alpha', 'range', {
    label: 'Alpha',
    step: 0.01,
    min: 0,
    max: 1
  })
  .addSlider(material, 'alphaCutoff', 'range', {
    label: 'Alpha Cutoff',
    step: 0.01,
    min: 0,
    max: 1
  })

  .addNumberInput(material, 'tiling', { label: 'Tiling' })

  .addStringInput(material, 'baseMap', { label: 'Base Map' })
  .addButton(material, 'clearBaseMap', { label: '×' })

  .addStringInput(material, 'normalMap', { label: 'Normal/Bump Map' })
  .addButton(material, 'clearNormalMap', { label: '×' })

  .addStringInput(material, 'metalnessMap', { label: 'Metalness Map' })
  .addButton(material, 'clearMetalnessMap', { label: '×' })

  .addSlider(material, 'metalness', 'range', {
    label: 'Metalness',
    step: 0.01,
    min: 0,
    max: 1
  })

  .addStringInput(material, 'roughnessMap', { label: 'Roughness Map' })
  .addButton(material, 'clearRoughnessMap', { label: '×' })

  .addSlider(material, 'roughness', 'range', {
    label: 'Roughness',
    step: 0.01,
    min: 0,
    max: 1
  })

  .addStringInput(material, 'aoMap', { label: 'Parallax Occlusion Map' })
  .addButton(material, 'clearAoMap', { label: '×' })

  .addSlider(material, 'scale', 'range', {
    label: 'Scale',
    step: 0.01,
    min: 0,
    max: 1
  })

  .addColor(material, 'emission', { label: 'Emission' })
  .addNumberInput(material, 'emissionIntensity', {
    label: 'Emission Intensity',
    step: 0.1
  })

  .addStringInput(material, 'emissiveMap', { label: 'Emissive Map' })
  .addButton(material, 'clearEmissiveMap', { label: '×' });
