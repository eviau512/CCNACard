import os
from PIL import Image, ImageDraw

def draw_switch_icon(size):
    # Create RGBA canvas
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    margin = int(size * 0.07)
    radius = int(size * 0.22)
    border_width = max(3, int(size * 0.08)) # Thick border

    # Cisco Process Cyan / Blue #0096D6 (RGB: 0, 150, 218)
    fill_color = (0, 150, 218, 255)
    # Deep rich Cisco Navy #004578
    border_color = (0, 65, 115, 255)

    # 1. Draw rounded rectangle with thick border
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=radius,
        fill=fill_color,
        outline=border_color,
        width=border_width
    )

    # 2. Draw 4 crisp pure white arrows:
    # 上/下各一组左/右箭头 (和 Packet Tracer switch 顶盖完全一致):
    # 每组箭头应为左侧箭头偏下，右侧偏上，但是上面一组的左箭头比下面一组的右箭头高:
    # 1. Upper Right arrow (-->): y_ur (Highest)
    # 2. Upper Left arrow (<--): y_ul
    # 3. Lower Right arrow (-->): y_lr
    # 4. Lower Left arrow (<--): y_ll (Lowest)
    arrow_color = (255, 255, 255, 255)
    cx = size * 0.5
    cy = size * 0.5

    arrow_len = size * 0.28
    gap = size * 0.08
    shaft_thick = max(2, int(size * 0.054))
    head_len = size * 0.10
    head_w = size * 0.085

    y_group_gap = size * 0.07
    y_stagger = size * 0.13

    def draw_arrow(x_start, x_end, y, pointing_right):
        if pointing_right:
            shaft_end = x_end - head_len * 0.4
            draw.line([(x_start, y), (shaft_end, y)], fill=arrow_color, width=shaft_thick)
            tip = (x_end, y)
            top_pt = (x_end - head_len, y - head_w)
            bot_pt = (x_end - head_len, y + head_w)
            draw.polygon([tip, top_pt, bot_pt], fill=arrow_color)
        else:
            shaft_start = x_start + head_len * 0.4
            draw.line([(shaft_start, y), (x_end, y)], fill=arrow_color, width=shaft_thick)
            tip = (x_start, y)
            top_pt = (x_start + head_len, y - head_w)
            bot_pt = (x_start + head_len, y + head_w)
            draw.polygon([tip, top_pt, bot_pt], fill=arrow_color)

    left_start = cx - gap/2.0 - arrow_len
    left_end = cx - gap/2.0

    right_start = cx + gap/2.0
    right_end = cx + gap/2.0 + arrow_len

    y_ur = cy - y_group_gap - y_stagger
    y_ul = cy - y_group_gap
    y_lr = cy + y_group_gap
    y_ll = cy + y_group_gap + y_stagger

    # Upper Group: Left arrow lower, Right arrow higher
    draw_arrow(left_start, left_end, y_ul, pointing_right=False)
    draw_arrow(right_start, right_end, y_ur, pointing_right=True)

    # Lower Group: Left arrow lower, Right arrow higher
    draw_arrow(left_start, left_end, y_ll, pointing_right=False)
    draw_arrow(right_start, right_end, y_lr, pointing_right=True)

    return img

def main():
    base_res = 'CCNA-App/app/src/main/res'
    densities = {
        'mipmap-mdpi': 48,
        'mipmap-hdpi': 72,
        'mipmap-xhdpi': 96,
        'mipmap-xxhdpi': 144,
        'mipmap-xxxhdpi': 192
    }

    for folder, size in densities.items():
        dir_path = os.path.join(base_res, folder)
        os.makedirs(dir_path, exist_ok=True)
        icon_path = os.path.join(dir_path, 'ic_launcher.png')
        icon_round_path = os.path.join(dir_path, 'ic_launcher_round.png')
        
        hi_res = draw_switch_icon(size * 4)
        scaled = hi_res.resize((size, size), Image.Resampling.LANCZOS)
        scaled.save(icon_path, 'PNG')
        scaled.save(icon_round_path, 'PNG')
        print(f"Generated {folder}/ic_launcher.png ({size}x{size})")

    large_icon = draw_switch_icon(512 * 2).resize((512, 512), Image.Resampling.LANCZOS)
    large_dir = os.path.join(base_res, 'drawable')
    os.makedirs(large_dir, exist_ok=True)
    large_icon.save(os.path.join(large_dir, 'ic_switch_large.png'), 'PNG')
    print("Generated 512x512 master icon.")

if __name__ == '__main__':
    main()
