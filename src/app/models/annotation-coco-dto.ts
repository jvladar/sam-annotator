import {ImageCoco} from "./coco/imageCoco";

export class AnnotationCocoDto {
    public imageName: ImageCoco;
    public annotation: number[];
    public categoryName: string;

    constructor(imageName: ImageCoco, annotation: number[], categoryName: string) {
        this.imageName = imageName;
        this.annotation = annotation;
        this.categoryName = categoryName;
    }
}