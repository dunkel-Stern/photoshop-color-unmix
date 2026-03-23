<img src="screenshot.png" width="600">

# Color Unmix (Photoshop UXP Plugin)

Works best on images with flat backgrounds, for example white studio shots.

Remove a flat background color, like white, by converting it into real transparency using color unmixing.

## What this plugin does

This plugin removes a known flat color from an image and converts it into transparency while preserving color and shadow information.

It is based on mathematical color unmixing, not AI or subject detection.

## What it is NOT

This is not automatic background removal.

- It does not detect subjects
- It does not work on complex or mixed backgrounds
- It assumes a flat, uniform background color
- It is not a replacement for Photoshop masking tools on arbitrary images

If your image has a complex background, use Photoshop selection and masking tools instead.

## What makes it useful

Unlike typical masking or threshold-based removal, this plugin can preserve:

- soft shadows
- edge detail
- color bleed
- semi-transparent transitions

This makes it useful for compositing assets onto different backgrounds without the usual white halo problem.

## Recommended shadow workflow

If you want to preserve soft shadows, the best workflow is usually:

1. Create a clean object layer without background and without shadows
2. Use Color Unmix on the original flat-background image
3. Keep the unmix result as a separate shadow and color-contribution layer
4. Composite both layers together on the new background

In other words:

- clean object layer = main subject
- Color Unmix layer = shadow and color contribution layer

This usually gives better control than trying to use the unmix result alone as the final cutout.

## Important limitation

Color Unmix removes the chosen background color mathematically. It does not relight the image for a new background.

Because of that, light-tinted shadows or reflections can behave strangely on darker backgrounds.

Example:
- if a shadow contains a light color tint from the original background
- and you place the result on a background darker than that tint

the shadow may turn into an unnatural light cast instead of looking physically correct.

For this reason, the plugin works best when:

- the background is flat and known
- the result is used as a transparency extraction tool
- shadows are handled as a separate compositing layer when needed

## Example workflow

These examples show what Color Unmix actually does.

It is not automatic background removal.  
It removes a known flat background color into transparency, which is especially useful for extracting shadow and color contribution layers.

### 1. Original image on white background

<img src="demo/demo-01-original.jpg" width="700">

### 2. After Color Unmix on the original white background

<img src="demo/demo-02-after-on-white.jpg" width="700">

This shows that the result stays visually close to the original on the source background.

### 3. Raw Color Unmix result on a 50% gray background

<img src="demo/demo-03-after-on-gray.jpg" width="700">

### 4. Raw Color Unmix result on a black background

<img src="demo/demo-04-after-on-black.jpg" width="700">

These examples show the raw transparency result by itself.  
This can preserve useful shadow and color contribution information, but it can also produce unnatural light casts on darker backgrounds when the original shadow contains light-tinted information from the source background.

### 5. Recommended workflow on 50% gray:
clean masked object layer on top, Color Unmix result used as shadow and color contribution layer underneath

<img src="demo/demo-05-gray-with-clean-object-layer.jpg" width="700">

### 6. Recommended workflow on black:
clean masked object layer on top, Color Unmix result used as shadow and color contribution layer underneath

<img src="demo/demo-06-black-with-clean-object-layer.jpg" width="700">

This is the recommended way to use the plugin when you want clean object edges together with preserved soft shadows or color bleed.

## Best use cases

- product images on white background
- soft shadow extraction
- logos and UI assets on flat backgrounds
- cleaning white halos from edge pixels
- preparing assets for manual compositing

## Features

- Remove white or any RGB color
- Adjustable tolerance
- Works on raster layers
- Optional: convert transparency to layer mask

## Installation

1. Download the `.ccx` file from Releases
2. Double-click to install via Creative Cloud
3. Open Photoshop → Plugins → Color Unmix

## Usage

1. Select a raster layer
2. Choose target color, default is white
3. Click **Run Color Unmix**
4. Optional: click **Mask from transparency**

## Author

T. Podroushnyack
