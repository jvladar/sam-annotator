from segment_anything import sam_model_registry, SamPredictor
from scripts.mask2polygon import mask2polygon
import onnxruntime
import torch

import numpy as np

class SamImagePredictor:
    def __init__(self, checkpoint_path, onnx_model_path, model_type="default"):
        self.checkpoint_path = checkpoint_path
        self.onnx_model_path = onnx_model_path
        self.model_type = model_type
        self.image = None
        self.sam = sam_model_registry[model_type](checkpoint=checkpoint_path)
        self.ort_session = onnxruntime.InferenceSession(onnx_model_path)
        self.predictor = SamPredictor(self.sam)

    def set_image(self, image_data, image_name):
        self.image = image_data
        self.predictor.set_image(self.image)

    def calculate_position(self, x, y):
        input_point = np.array([[int(x), int(y)]])
        input_label = np.array([1])

        masks, scores, logits = self.predictor.predict(
            point_coords=input_point,
            point_labels=input_label,
            multimask_output=True,
        )

        best_mask_index = np.argmax(scores)
        binary_mask = torch.from_numpy(masks[best_mask_index]).squeeze().numpy().astype(np.uint8)

        image_polygon = mask2polygon(binary_mask)

        return image_polygon


    def bounding_box_anotation(self, x, y, x1, y1):
        input_box = np.array([x, y, x1, y1])
        mask, scores, _ = self.predictor.predict(
            point_coords=None,
            point_labels=None,
            box=input_box[None, :],
            multimask_output=True,
        )
        best_mask_index = np.argmax(scores)

        binary_mask = torch.from_numpy(mask[best_mask_index]).squeeze().numpy().astype(np.uint8)
        image_polygon = mask2polygon(binary_mask)
        return image_polygon


