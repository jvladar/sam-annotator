export class InfoCoco {
    public year: number;
    public version: string;
    public description: string;
    public contributor: string;
    public url: string;
    public date_created: string;


    constructor(year: number, version: string, description: string, contributor: string, url: string, date_created: string) {
        this.year = year;
        this.version = version;
        this.description = description;
        this.contributor = contributor;
        this.url = url;
        this.date_created = date_created;
    }
}