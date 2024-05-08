import io
import cv2
import base64
import numpy as np
import imutils
from PIL import Image, ImageDraw

# Funkcie na prekreslenie masiek na obrázok

def show_mask(mask):
    color = np.array([30/255, 144/255, 255/255, 0.6])
    h, w = mask.shape[-2:]
    mask_image = mask.reshape(h, w, 1) * color[:3].reshape(1, 1, -1)
    mask_image = (mask_image * 255).astype(np.uint8)
    return Image.fromarray(mask_image)

def show_masks(mask_raw):
    mask = mask_raw['segmentation']
    color = np.concatenate([np.random.random(3), [0.35]])
    h, w = mask.shape[-2:]
    mask_image = mask.reshape(h, w, 1) * color[:3].reshape(1, 1, -1)
    mask_image = (mask_image * 255).astype(np.uint8)
    return Image.fromarray(mask_image)


def show_points(coords, labels, ax, marker_size=375):
    pos_points = coords[labels==1]
    neg_points = coords[labels==0]
    ax.scatter(pos_points[:, 0], pos_points[:, 1], color='green', marker='*', s=marker_size, edgecolor='white', linewidth=1.25)
    ax.scatter(neg_points[:, 0], neg_points[:, 1], color='red', marker='*', s=marker_size, edgecolor='white', linewidth=1.25)   

    
def read_image(image_path):
    image = cv2.imread(image_path)
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    return image

def read_image_UI(imgBuffer):
    encoded_data = imgBuffer.split(',')[1]
    nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    image = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    image = imutils.resize(image, width=1000)
    return image

def combine_images(original_image, mask_image, mask_opacity = 0.55):

    original_array = np.array(original_image)
    mask_array = np.array(mask_image)

    mask_array = mask_array.astype(np.float32)

    # resize mask to match aspect ratio of original image
    orig_height, orig_width, _ = original_array.shape
    mask_array = cv2.resize(mask_array, (orig_width, orig_height))

    mask_array = np.squeeze(mask_array)

    print("mask_array.shape: ", mask_array.shape)
    print("original_array.shape: ", original_array.shape)
    # combine mask and original image apply mask_array color and gray original array where mask_array is not 0, 
    combined_array = np.where(mask_array != 0, mask_array * mask_opacity + original_array * (1 - mask_opacity), original_array)
    
    combined_image = Image.fromarray(combined_array.astype(np.uint8))

    return combined_image


def show_image(image, masks = None, box = None):
    image = Image.fromarray(image)
    
    if masks is not None:
        mask_image = show_mask(masks)
        combined_image = combine_images(image, mask_image)
        if box is not None:
            height, width, _ = np.array(combined_image).shape
            box_image = show_box(box, height, width)
            combined_image = combine_images(combined_image, box_image)

        img_buffer = io.BytesIO()
        combined_image.save(img_buffer, format='PNG')
    else:
        img_buffer = io.BytesIO()
        image.save(img_buffer, format='PNG')
        
    img_buffer.seek(0)
    img_data = img_buffer.read()
    img_buffer.close()
    
    return img_data

def show_image_poly(image, masks = None, box = None):
    image = Image.fromarray(image)

    if masks is not None:
        combined_image = combine_images(image, masks)
        if box is not None:
            height, width, _ = np.array(combined_image).shape
            box_image = show_box(box, height, width)
            combined_image = combine_images(combined_image, box_image)

        img_buffer = io.BytesIO()
        combined_image.save(img_buffer, format='PNG')
    else:
        img_buffer = io.BytesIO()
        image.save(img_buffer, format='PNG')

    img_buffer.seek(0)
    img_data = img_buffer.read()
    img_buffer.close()

    return img_data


def show_image_multiple(image, masks = None):
    image = Image.fromarray(image)

    if masks is not None:
        for mask in masks:
            mask_image = show_masks(mask)
            image = combine_images(image, mask_image)

        img_buffer = io.BytesIO()
        image.save(img_buffer, format='PNG')
    else:
        img_buffer = io.BytesIO()
        image.save(img_buffer, format='PNG')

    img_buffer.seek(0)
    img_data = img_buffer.read()
    img_buffer.close()
    return img_data

def show_box(box, height, width):
    x, y = box[0], box[1]
    w, h = box[2] - box[0], box[3] - box[1]

    # Create a blank image with an alpha channel
    img = Image.new("RGB", (width, height), (0, 0, 0, 0))

    # Draw the rectangle on the image
    draw = ImageDraw.Draw(img)
    draw.rectangle([x, y, box[2], box[3]], outline='green', width=4)

    return img


def show_anns(anns):
    if len(anns) == 0:
        return
    sorted_anns = sorted(anns, key=(lambda x: x['area']), reverse=True)

    img = np.ones((sorted_anns[0]['segmentation'].shape[0], sorted_anns[0]['segmentation'].shape[1], 4))
    img[:,:,3] = 0
    for ann in sorted_anns:
        m = ann['segmentation']
        color_mask = np.concatenate([np.random.random(3), [0.35]])
        img[m] = color_mask

    img = (img * 255).astype(np.uint8)
    return Image.fromarray(img)

