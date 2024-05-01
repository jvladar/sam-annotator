import {ImageFileDatas} from "./imageFileDatas";

export class ProjectEditedDto {
    public name: string;
    public imageFileDatas: ImageFileDatas[];
    public imagesToDeleteWithProject: string[];

    constructor(name: string, imageFileDatas: ImageFileDatas[], imagesToDeleteWithProject: string[]) {
        this.name = name;
        this.imageFileDatas = imageFileDatas;
        this.imagesToDeleteWithProject = imagesToDeleteWithProject;
    }
}