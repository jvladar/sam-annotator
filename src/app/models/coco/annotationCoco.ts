export class AnnotationCoco {
    public id: number;
    public image_id: number;
    public category_id: number;
    public segmentation: [number[]];
    public area: number;
    public bbox: [number, number, number, number];
    public iscrowd: number;

    constructor(id: number, image_id: number, category_id: number, segmentation: [number[]], area: number, bbox: [number, number, number, number], iscrowd: number) {
        this.id = id;
        this.image_id = image_id;
        this.category_id = category_id;
        this.segmentation = segmentation;
        this.area = area;
        this.bbox = bbox;
        this.iscrowd = iscrowd;
    }
}