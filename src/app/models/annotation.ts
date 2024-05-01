export class Annotation {
    public type: string;
    public index: number;
    public visibility: boolean;
    public id = "";

    constructor(item: any) {
        this.type = item.type;
        this.index = item.index;
        this.visibility = false;
        this.id = item.id;
        if (item.visibility === 'visible') {
            this.visibility = true;
        }
    }

    public update(color: string): void {
        this.type = color;
    }
}
