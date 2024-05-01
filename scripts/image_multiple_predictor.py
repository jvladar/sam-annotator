from segment_anything import sam_model_registry, SamAutomaticMaskGenerator
from scripts.utils import read_image, read_image_UI, show_image, show_image_multiple
import onnxruntime
from scripts.mask2polygon import mask2polygon
import torch
import numpy as np


class SamMultiImagePredictor:
    def __init__(self, checkpoint_path, onnx_model_path, model_type="default"):
        self.checkpoint_path = checkpoint_path
        self.onnx_model_path = onnx_model_path
        self.model_type = model_type
        self.image = None
        self.sam = sam_model_registry[model_type](checkpoint=checkpoint_path)
        self.ort_session = onnxruntime.InferenceSession(onnx_model_path)
        self.mask_generator = SamAutomaticMaskGenerator(self.sam)

    def set_image(self, image_path):
        self.image = image_path

    def generate_masks(self):
        masks = self.mask_generator.generate(self.image)

        masks_polygon = []
        for mask in masks:
            binary_mask = torch.from_numpy(mask['segmentation']).squeeze().numpy().astype(np.uint8)
            image_polygon = mask2polygon(binary_mask, True)
            masks_polygon.append(image_polygon[0])
        return masks_polygon

        #img_data = show_image_multiple(self.image, masks)
        # return img_data
