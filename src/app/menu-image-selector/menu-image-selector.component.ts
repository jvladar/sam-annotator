import { Component, OnInit, ViewChild } from '@angular/core';
import { MaskingService } from '../services/masking.service';
import { ActivatedRoute } from '@angular/router';
import {ImageFileDatas} from "../models/imageFileDatas";
import {UnigueIdGeneratorService} from "../services/unigue-id-generator.service";

@Component({
  selector: 'app-image-selector',
  templateUrl: './menu-image-selector.component.html',
  styleUrls: ['./menu-image-selector.component.css']
})
export class MenuImageSelectorComponent implements OnInit{
  msg = "";
  @ViewChild('url') url;
  @ViewChild('imageNumber') num;
  public imageFileDatas: ImageFileDatas[] = [];
  googleDriveOn = false;
  rectangleModeOn = false;

  constructor(private maskSvc: MaskingService,
              private idGenerator: UnigueIdGeneratorService) { }

  ngOnInit(): void {
    this.maskSvc.getImageFileDatas().subscribe(urlsData => {
      this.imageFileDatas = urlsData;
    });
  }

  public updateImage(): void {
    this.maskSvc.setImageUrl(this.url.nativeElement.value);
  }

  public rectangleMode() {
    if(!this.rectangleModeOn) {
      this.rectangleModeOn = true;
    } else {
      this.rectangleModeOn = false;
    }
  }


  showImage(event: any) {
    for (let i= 0; i < event.target.files.length; i++) {
      if(!event.target.files[i] || event.target.files[i].length == 0) {
        this.maskSvc.setModal("Musíte vybrať obrázok");
        return;
      }

      var mimeType = event.target.files[i].type;

      if (mimeType.match(/image\/*/) == null) {
        this.maskSvc.setModal("Nahraté súbory musia byť len obrázky");
        return;
      }
    }
    if (event.target.files.length > 0) {
      const files = event.currentTarget.files;
      const promises = [];

      Object.keys(files).forEach(i => {
        const file = files[i];
        const readerA = new FileReader();

        const promise = new Promise(resolve => {
          readerA.onload = (e) => {
            if (typeof readerA.result === "string") {
              var imageData = new ImageFileDatas();
              var image = new Image();
              imageData.name = file.name;
              imageData.data = readerA.result;
              image.src = imageData.data;
              image.onload = () => {
                imageData.height = image.height / image.width * 1000;
                imageData.width = 1000
                imageData.projectName = this.maskSvc.currentProject;
                if (this.isFilenameUnique(imageData.name)) {
                  imageData.id = this.idGenerator.generateUniqueId();
                  this.imageFileDatas.push(imageData);
                }
                resolve();
              }
            }
          };
        });

        readerA.readAsDataURL(file);
        promises.push(promise);
      });

      Promise.all(promises).then(() => {
        this.maskSvc.setImageFileDatas(this.imageFileDatas);
      });
    }
  }

  isFilenameUnique(fileName: string): boolean {
    for (const imageData of this.imageFileDatas) {
      if (fileName === imageData.name) {
        return false;
      }
    }
    return true;
  }

  public isGoogleOn() {
    if (!this.googleDriveOn) {
      let googleUrl = this.num.nativeElement.value;
      this.googleDriveOn = true;
    } else {
      this.googleDriveOn = false;
    }
  }

}
