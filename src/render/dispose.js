// Libera da memória de vídeo tudo o que uma cena usa (malhas, materiais,
// texturas, sombras). renderer.dispose() sozinho não faz isso.
export function disposeScene(scene) {
  const textures = new Set();
  const collect = (value) => {
    if (value?.isTexture) textures.add(value);
    else if (value?.value?.isTexture) textures.add(value.value);
  };
  scene.traverse((o) => {
    o.geometry?.dispose();
    const materials = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of materials) {
      Object.values(m).forEach(collect);
      if (m.userData?.uniforms) Object.values(m.userData.uniforms).forEach(collect);
      if (m.uniforms) Object.values(m.uniforms).forEach(collect);
      m.dispose();
    }
    if (o.isLight && o.shadow?.map) o.shadow.dispose();
    if (o.isInstancedMesh) o.dispose();
    o.skeleton?.dispose(); // textura dos ossos de cada boneco
  });
  for (const t of textures) t.dispose();
}
