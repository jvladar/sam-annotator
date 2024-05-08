from flask import Flask, request
from flask_socketio import SocketIO
import os
import scripts.utils
from scripts.image_predictor import SamImagePredictor
from scripts.image_multiple_predictor import SamMultiImagePredictor

main_path = os.path.dirname(os.path.abspath(__file__))

checkpoint = os.path.join(main_path, 'models/sam_vit_h_4b8939.pth')
onnx_model = os.path.join(main_path, 'models/sam_onnx_quantized_example.onnx')
images_folder = os.path.join(main_path, 'static/images')
model_type = 'default'

sam = SamImagePredictor(checkpoint, onnx_model, model_type)
samMulti = SamMultiImagePredictor(checkpoint, onnx_model, model_type)

app = Flask(__name__)
app.config['SECRET_KEY'] = 'mysecret'
socketio = SocketIO(app, cors_allowed_origins='http://localhost:4200')

image_index = 0

@socketio.on('click')
def click(event):
    x, y = event['x'], event['y']

    if x < 0 or y < 0 or x > sam.image.shape[1] or y > sam.image.shape[0]:
        return
    else:
        print("clickmask")
        img_data = sam.calculate_position(x, y)

    socketio.emit('masks', img_data)

@socketio.on('boundingbox')
def boundingbox(event):
    x, y, x1, y1 = event['x'], event['y'], event['x1'], event['y1']

    if x < 0 or y < 0 or x > sam.image.shape[1] or y > sam.image.shape[0]:
        return
    if x1 < 0 or y1 < 0 or x1 > sam.image.shape[1] or y1 > sam.image.shape[0]:
        return
    else:
        print("boundingbox")
        img_data = sam.bounding_box_anotation(x, y, x1, y1)

    socketio.emit('masks', img_data)

@socketio.on('multimask')
def multimask():
    print("multimask")
    img_data = samMulti.generate_masks()
    socketio.emit('masks', img_data)


@socketio.on('set_image')
def set_image(event):
    print("set_image")
    img = scripts.utils.read_image_UI(event['image'])
    sam.set_image(img, event['image_name'])
    samMulti.set_image(img)
    print("send")
    socketio.emit('show_image', True)


if __name__ == '__main__':
    socketio.run(app)
