import {Component, OnInit, ViewChild, HostListener, Input} from '@angular/core';
import { MaskingService } from '../services/masking.service';
import { Annotation } from '../models/annotation';
import { environment } from 'src/environments/environment';
import { AnnotationChange } from '../models/annotation-change';
import {Coco} from "../models/coco/coco";
import JSZip from "jszip";
import {ImageFileDatas} from "../models/imageFileDatas";
import {UnigueIdGeneratorService} from "../services/unigue-id-generator.service";

@Component({
  selector: 'app-layers',
  templateUrl: './annotations.component.html',
  styleUrls: ['./annotations.component.css']
})
export class AnnotationsComponent implements OnInit {

  protected readonly environment = environment;

  public layers: Annotation[];
  public colors;
  public value;
  public projectName: string;
  public projectIndex: number = 0;
  public selectedLayer: undefined | number;
  public imageFileDatas: ImageFileDatas[] = [];
  @Input() dropdownOn = true;
  @ViewChild('opacity') opacityForm;

  constructor(public maskSvc: MaskingService,
              private idGenerator: UnigueIdGeneratorService) { }

  ngOnInit(): void {
    this.projectName = environment.project[0].name;
    this.colors = environment.project[0].colors;

    this.maskSvc.getProjectChange().subscribe(name => {
      this.projectName = name;
      this.projectIndex = environment.project.findIndex(e => e.name === this.projectName);
      this.colors = environment.project[this.projectIndex].colors;
    })

    this.maskSvc.getImageFileDatas().subscribe(urlsData => {
      this.imageFileDatas = urlsData;
    });

    this.maskSvc.getLayers().subscribe(layers => {
      this.layers = layers.filter( x => x.id === this.maskSvc.getSelectedImage()).reverse();
      if(this.layers.length < 1){
        this.layers = undefined;
      }
    })

    this.maskSvc.getFocusedLayer().subscribe(index => {
      if (this.selectedLayer != index) {
        this.selectedLayer = index;
      }
    })
  }

  public toTop(i: number): void {
    this.maskSvc.modifyLayer(new AnnotationChange({index: i, type: 'up'}))
  }

  public toBottom(i: number): void {
    this.maskSvc.modifyLayer(new AnnotationChange({index: i, type: 'down'}))
  }

  public toYolo() {
    this.maskSvc.changeEmit(new AnnotationChange({index: 0, type: 'yolo'}));
  }

  public toYoloZip() {
    this.maskSvc.changeEmit(new AnnotationChange({index: 0, type: 'yolo-all'}));
  }

  public toCoco() {
    this.maskSvc.changeEmit(new AnnotationChange({index: 0, type: 'coco'}));
  }

  public toCocoZip() {
    this.maskSvc.changeEmit(new AnnotationChange({index: 0, type: 'coco-all'}));
  }

  letters = '0123456789ABCDEF';
  color = '#';

  getRandomColor() {
    this.color = "#";
    for (var i = 0; i < 6; i++) {

      this.color += this.letters[Math.floor(Math.random() * 16)];
    }
    return this.color;
  }

  public fromCoco(event: any) {
    this.value = undefined;
    const fileInput = event.target;
    const file = fileInput.files[0];

    var mimeType = event.target.files[0].type;

    if (mimeType !== 'application/json') {
      this.maskSvc.setModal("Nahratý súbor musí byť vo formáte JSON");
      return;
    }

    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;

        const coco = JSON.parse(content) as Coco;
        for (let category of coco.categories) {
          let categoryExist = this.environment.project[this.projectIndex].colors.findIndex(e => e.name === category.name);
          if (categoryExist == -1) {
            this.environment.project[this.projectIndex].colors.push({name: category.name, color: this.getRandomColor() });
          }
        }

        for (let annotation of coco.annotations) {
          let image = coco.images.filter( x => x.id === annotation.image_id)
          let category = coco.categories.filter( x => x.id === annotation.category_id)
          this.maskSvc.setCocoLayer(category[0].name, annotation.segmentation[0], image[0])
        }

      };
      reader.readAsText(file);
    }
  }

  public async processImage(file: File) {
    if (!file || file.size === 0) {
      console.error('Empty or invalid file:', file);
      return;
    }

    const fileName = file.name;
    const fileExtension = fileName.split('.').pop().toLowerCase(); // Get file extension

    if (!['jpg', 'jpeg', 'png', 'gif'].includes(fileExtension)) {
      this.maskSvc.setModal('Nepodporovaný typ súboru v priečinku "images"');
      return;
    }

    const reader = new FileReader();

    const imageData = new ImageFileDatas();
    imageData.name = file.name;

    reader.onload = (e) => {
      if (typeof reader.result === 'string') {
        const image = new Image();
        image.src = reader.result;

        image.onload = () => {
          imageData.data = reader.result;
          imageData.height = image.height / image.width * 1000;
          imageData.width = 1000;
          imageData.projectName = this.projectName;
          imageData.id = this.idGenerator.generateUniqueId();
          this.imageFileDatas.push(imageData);
        };
      }
    };

    reader.readAsDataURL(file);
  }

  public async handleFileUpload(event: any) {
    const zipFile = event.target.files[0];

    if (!zipFile) {
      this.maskSvc.setModal("Musíte nahrať aspoň jeden súbor");
      return;
    }

    const mimeType = zipFile.type;
    if (mimeType !== 'application/zip' && mimeType !== 'application/x-zip-compressed') {
      this.maskSvc.setModal("Nahratý súbor musí byť vo formáte ZIP");
      return;
    }

    // Read zip file contents
    const zip = new JSZip();
    await zip.loadAsync(zipFile);

    const imagesFolder = zip.folder('images');
    const labelsFolder = zip.folder('labels')
    if (!imagesFolder) {
      this.maskSvc.setModal('Chýbajúci priečinok "images" v zip súbore');
      return;
    }

    if (!labelsFolder) {
      this.maskSvc.setModal('Chýbajúci priečinok "labels" v zip súbore');
      return;
    }

    const promises = [];

    imagesFolder.forEach((relativePath, zipEntry) => {
      if (!zipEntry.dir) { // Check if it's a file
        const promise = new Promise<void>((resolve, reject) => {
          zipEntry.async('blob').then(blob => {
            const file = new File([blob], zipEntry.name.replace(/^images\//, '')); // Create a File object
            this.processImage(file).then(() => {
              resolve();
            }).catch(error => {
              reject(error);
            });
          }).catch(error => {
            reject(error);
          });
        });
        promises.push(promise);
      }
    });

    Promise.all(promises).then(() => {
      this.maskSvc.setImageFileDatas(this.imageFileDatas);
      labelsFolder.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir) { // Check if it's a file
          zipEntry.async('string').then(content => {
            this.maskSvc.setUploadedLayers(zipEntry.name.replace(/^labels\//, ''), content);
          });
        }
      });
    }).catch(error => {
      console.error('Error processing files:', error);
    });
  }


  public delete(i: number): void {
    if(this.layers.length === 1){
      this.layers = undefined;
    }
    this.maskSvc.modifyLayer(new AnnotationChange({index: i, type: 'delete'}));
  }

  public deleteAllColor(i: number): void {
    for (const layer of this.layers) {
      if (this.colors[i].color === layer.type) {
        if (this.layers.length === 0) {
          this.layers = undefined;
        }
        this.maskSvc.modifyLayer(new AnnotationChange({index: layer.index, type: 'delete'}));
      }
    }
  }

  public toggleAllColor(i: number): void {
    for (const layer of this.layers) {
      if(this.colors[i].color === layer.type){
        this.maskSvc.modifyLayer(new AnnotationChange({index: layer.index, type: 'toggle'}));
      }
    }
  }

  public toggle(i: number): void {
    this.maskSvc.modifyLayer(new AnnotationChange({index: i, type: 'toggle'}));
  }

  public toggleAll(): void {
    this.maskSvc.modifyLayer(new AnnotationChange({index: 0, type: 'toggleAll'}));
  }

  public updateOpacity(): void {
    this.maskSvc.modifyLayer(new AnnotationChange({index: parseInt(this.opacityForm.nativeElement.value), type: 'opacity'}));
  }

  public deleteAll(): void {
    this.maskSvc.modifyLayer(new AnnotationChange({index: 0, type: 'clearAll'}));
  }  

  public getLayerType(layerColor: string): {name:string, color:string}{
    if( layerColor === 'existingMask') {
      return {name:'Existing Mask', color: 'black'};
    }
    return environment.project[this.projectIndex].colors.filter(color => color.color == layerColor)[0];
  }

  public incrementOpacity(up: boolean): void {
    let opacity = parseInt(this.opacityForm.nativeElement.value);
    if (up) {
        opacity = Math.min(opacity + 10, 100);
    } else {
        opacity = Math.max(opacity - 10, 0);
    }
    this.opacityForm.nativeElement.value = opacity;
    this.updateOpacity();
  }

  public setColor(layer: Annotation, index: number) {
    this.layers.forEach(e => {
      if(e.index === layer.index) {
        e.update(this.colors[index].color)
      }
    });
    this.maskSvc.modifyLayer(new AnnotationChange(layer));
  }

  @HostListener('document:keyup', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
      if (event.code === 'ArrowUp') { this.incrementOpacity(true); }
      if (event.code === 'ArrowDown') { this.incrementOpacity(false); }
      if (event.code === 'Comma') { this.toggleAll(); }
  }
}
