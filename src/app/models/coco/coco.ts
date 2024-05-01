import {InfoCoco} from "./infoCoco";
import {LicenseCoco} from "./licenseCoco";
import {CategoryCoco} from "./categoryCoco";
import {ImageCoco} from "./imageCoco";
import {AnnotationCoco} from "./annotationCoco";

export class Coco {
    public info: InfoCoco;
    public licenses: LicenseCoco[];
    public categories: CategoryCoco[];
    public images: ImageCoco[];
    public annotations: AnnotationCoco[];


    constructor(info: InfoCoco, licenses: LicenseCoco[], categories: CategoryCoco[], images: ImageCoco[], annotations: AnnotationCoco[]) {
        this.info = info;
        this.licenses = licenses;
        this.categories = categories;
        this.images = images;
        this.annotations = annotations;
    }
}