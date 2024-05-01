export class ImageCoco {
    public id: number;
    public width: number;
    public height: number;
    public file_name: string;
    public license: number;
    public date_captured: string | undefined;


    constructor(id: number, width: number, height: number, file_name: string, license: number, date_captured: string | undefined) {
        this.id = id;
        this.width = width;
        this.height = height;
        this.file_name = file_name;
        this.license = license;
        this.date_captured = date_captured;
    }
}
