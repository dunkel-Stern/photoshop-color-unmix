<img src="screenshot.png" width="600">

# Color Unmix (Photoshop UXP Plugin)

Remove white or any flat color from an image while preserving realistic shadows and color bleed.

## Why this plugin exists

Typical background removal in Photoshop:
- destroys soft shadows
- creates white halos
- looks wrong on dark backgrounds

This plugin takes a different approach:

👉 It removes the background color mathematically  
👉 Keeps shadow and color information as real transparency  

Result:
- shadows adapt naturally to any background
- no halos, no manual cleanup

---

## What makes it different

Unlike standard masking:
- Dark shadows stay visible on light backgrounds  
- Light reflections disappear correctly on dark backgrounds  
- Color bleed behaves naturally across any surface  

---

## Use cases

- Product images with soft shadows  
- Objects with color reflections  
- UI / web assets that must work on any background  
- Logos and icons with subtle edge shading  
- Cleaning composited images without losing realism  

---

## Features

- Remove white or any RGB color  
- Adjustable tolerance (controls color range)  
- Preserves shadow and edge detail  
- Optional: convert transparency to layer mask  

---

## Installation

1. Download the `.ccx` file from Releases  
2. Double-click to install via Creative Cloud  
3. Open Photoshop → Plugins → Color Unmix  

---

## Usage

1. Select a raster layer  
2. Choose target color (default is white)  
3. Click **Run Color Unmix**  
4. Optional: click **Mask from transparency**  

---

## Author

T. Podroushnyack
