use console::style;
use std::io::Result;
use std::{fs, path::Path};

use crate::image_processing::Image;

const TEXTURE_IMAGE_TYPES: [&str; 7] = [
    r#"tif"#, r#"tga"#, r#"tiff"#, r#"jpeg"#, r#"jpg"#, r#"gif"#, r#"png"#,
];

/// Find texture images in the specified path
pub fn scan_dir_for_images(dir: &Path) -> Result<Vec<Image>> {
    println!("\nScanning for images to webify...");
    println!(
    "{}",
    &style(
      "Note that webify models is a destructive action and will DELETE the existing non-PNG files."
    )
    .on_red()
  );

    let mut images = match recursive_scan(dir, Vec::new()) {
        Ok(image_list) => image_list,
        Err(error) => panic!("Failed to scan all directories for images: {:?}", error),
    };
    images.sort_by(|a, b| b.extension.cmp(&a.extension));

    println!("Images found: {}\n", style(images.len()).bold().blue());

    Ok(images)
}

/// Recursively scan the directory and only return files that qualify
/// as the images we're looking for
fn recursive_scan(dir: &Path, mut images: Vec<Image>) -> Result<Vec<Image>> {
    if dir.is_dir() {
        for entry in fs::read_dir(dir)? {
            let e = entry?;
            let path = e.path();

            if path.is_dir() {
                images = recursive_scan(&path, images.clone())?;
            } else {
                let extension = match path.extension() {
                    Some(ext) => ext.to_str().unwrap(),
                    _ => "",
                };

                if TEXTURE_IMAGE_TYPES.contains(&extension) {
                    images.push(Image {
                        path: path.clone(),
                        extension: extension.to_string(),
                    });
                };
            }
        }
    }

    Ok(images)
}

#[cfg(test)]
mod scan_dir_for_images_tests {

    #[test]
    #[ignore = "not yet implemented"]
    fn it_scans_the_dir() {
        assert!(false);
    }
}

#[cfg(test)]
mod recursive_scan_tests {
    use super::*;

    #[test]
    fn it_recursively_scans_the_dir() {
        let dir = &Path::new("tests")
            .join("image_processing")
            .join("image_scan");
        let results = recursive_scan(dir, Vec::new()).unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(
            results[0].path,
            dir.join("textures").join("materials").join("example.jpg")
        );
    }
}
