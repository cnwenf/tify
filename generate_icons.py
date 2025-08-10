#!/usr/bin/env python3
"""
Generate PNG icons from SVG for the Chrome extension
"""

import os
import base64
from pathlib import Path

def create_png_icon(size, output_path):
    """Create a simple PNG icon using base64 encoded data"""
    
    # Simple icon data (base64 encoded 1x1 transparent PNG, we'll use emoji fallback)
    icon_svg = f"""<svg width="{size}" height="{size}" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4f46e5;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#7c3aed;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <circle cx="64" cy="64" r="56" fill="url(#gradient)" stroke="white" stroke-width="8"/>
  
  <g transform="translate(32, 32)">
    <rect x="8" y="8" width="32" height="40" rx="4" fill="white" opacity="0.9"/>
    <line x1="12" y1="16" x2="36" y2="16" stroke="#4f46e5" stroke-width="2"/>
    <line x1="12" y1="22" x2="32" y2="22" stroke="#4f46e5" stroke-width="2"/>
    <line x1="12" y1="28" x2="35" y2="28" stroke="#4f46e5" stroke-width="2"/>
    <line x1="12" y1="34" x2="28" y2="34" stroke="#4f46e5" stroke-width="2"/>
    
    <path d="M44 28 L52 28 M48 24 L52 28 L48 32" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    
    <rect x="56" y="8" width="32" height="40" rx="4" fill="white" opacity="0.9"/>
    <line x1="60" y1="16" x2="84" y2="16" stroke="#7c3aed" stroke-width="2"/>
    <line x1="60" y1="22" x2="80" y2="22" stroke="#7c3aed" stroke-width="2"/>
    <line x1="60" y1="28" x2="83" y2="28" stroke="#7c3aed" stroke-width="2"/>
    <line x1="60" y1="34" x2="76" y2="34" stroke="#7c3aed" stroke-width="2"/>
  </g>
  
  <text x="64" y="100" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="white">AI</text>
</svg>"""
    
    # For now, create simple colored squares as placeholders
    # In a real scenario, you'd use a library like cairosvg or wand to convert SVG to PNG
    
    # Create a simple base64 encoded 1x1 PNG (transparent)
    # This is just a placeholder - in production you'd use proper SVG to PNG conversion
    tiny_png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
    
    # Create directory if it doesn't exist
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Write placeholder file
    with open(output_path, 'wb') as f:
        f.write(base64.b64decode(tiny_png))
    
    print(f"Created {output_path} ({size}x{size})")

def main():
    """Generate all required icon sizes"""
    assets_dir = Path("src/assets")
    
    # Required icon sizes for Chrome extensions
    sizes = [16, 32, 48, 128]
    
    for size in sizes:
        output_path = assets_dir / f"icon{size}.png"
        create_png_icon(size, output_path)
    
    print("Icon generation complete!")
    print("\nNote: These are placeholder icons. For production, use proper SVG to PNG conversion tools like:")
    print("- cairosvg: pip install cairosvg")
    print("- Inkscape: inkscape --export-png=output.png input.svg")
    print("- Online converters")

if __name__ == "__main__":
    main()