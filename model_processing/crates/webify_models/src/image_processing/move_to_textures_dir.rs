//! Move any stray textures to the textures path (typically materials/textures)

use std::{
  fs,
  path::{Path, PathBuf},
};

use console::style;
use indicatif::ProgressBar;

use crate::image_processing::Image;

/// Move any stray textures to the textures path (typically materials/textures)
pub fn move_to_textures_dir<'a>(
  mut image: Image,
  base_path: &Path,
  progress_bar: &ProgressBar,
) -> std::result::Result<Image, std::io::Error> {
  let file_name = image.path.file_name().unwrap().to_str().unwrap();
  let textures_path: PathBuf = Path::new("materials").join("textures").join(file_name);
  let meshes_path: PathBuf = Path::new("meshes").join(file_name);

  progress_bar.set_prefix("Texture Move");
  let styled_path = style(image.path.to_string_lossy()).dim();

  if !image.path.ends_with(textures_path) && !image.path.ends_with(meshes_path) {
    progress_bar.set_message(&format!("Moving {} to textures directory...", styled_path));
    let new_textures_path = get_new_textures_path(&image, base_path)?;
    fs::create_dir_all(&new_textures_path)?;

    progress_bar.set_message(&format!(
      "Created {}",
      style(&new_textures_path.to_string_lossy()).dim()
    ));

    fs::copy(&image.path, new_textures_path.join(file_name))?;
    fs::remove_file(&image.path)?;

    let new_textures_path_with_ext = new_textures_path.join(file_name).clone();
    progress_bar.set_message(&format!(
      "Moved {} to {}",
      style(styled_path).dim(),
      style(new_textures_path_with_ext.to_string_lossy()).dim()
    ));

    image.path = new_textures_path_with_ext;
  }

  Ok(image)
}

/// Get the root path of the model and tack on the texture path
fn get_new_textures_path(
  image: &Image,
  base_path: &Path,
) -> std::result::Result<PathBuf, std::io::Error> {
  let mut model_path_ancestors = image.path.strip_prefix(base_path).unwrap().ancestors();
  let model_path = model_path_ancestors
    .nth(model_path_ancestors.count() - 2)
    .unwrap(); // There must be a better way to do this...
  let new_textures_path = base_path
    .join(model_path)
    .join("materials")
    .join("textures");

  Ok(new_textures_path)
}