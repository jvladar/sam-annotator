from segment_anything import sam_model_registry, SamPredictor
from scripts.utils import read_image, read_image_UI, show_image
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

    def calculatee_position(self, x, y):
        input_point = np.array([[x, y]])
        input_label = np.array([1])
        onnx_coord = np.concatenate([input_point, np.array([[0.0, 0.0]])], axis=0)[None, :, :]
        onnx_label = np.concatenate([input_label, np.array([-1])], axis=0)[None, :].astype(np.float32)

        onnx_coord = self.predictor.transform.apply_coords(onnx_coord, self.image.shape[:2]).astype(np.float32)
        onnx_mask_input = np.zeros((1, 1, 256, 256), dtype=np.float32)
        onnx_has_mask_input = np.zeros(1, dtype=np.float32)

        ort_inputs = {
            "image_embeddings": self.image_embedding,
            "point_coords": onnx_coord,
            "point_labels": onnx_label,
            "mask_input": onnx_mask_input,
            "has_mask_input": onnx_has_mask_input,
            "orig_im_size": np.array(self.image.shape[:2], dtype=np.float32)
        }

        masks, _, logits = self.ort_session.run(None, ort_inputs)

        masks = masks > self.predictor.model.mask_threshold
        img_data = show_image(self.image, masks)
        return img_data


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

        #img_data = show_image(self.image, masks[best_mask_index])
        #return img_data

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

        # VERZIA S MASKOU, nizsie je verzia s polygonom - riadky 100 az 102
        # img_data = show_image(self.image, mask[best_mask_index], box)

        binary_mask = torch.from_numpy(mask[best_mask_index]).squeeze().numpy().astype(np.uint8)
        image_polygon = mask2polygon(binary_mask)
        return image_polygon


