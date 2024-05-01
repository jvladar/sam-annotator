import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { Color } from '../models/color';
import { Observable, Subject } from 'rxjs';
import { Annotation } from '../models/annotation';
import { AnnotationChange } from '../models/annotation-change';
import {ImageFileDatas} from "../models/imageFileDatas";
import {AnnotationCocoDto} from "../models/annotation-coco-dto";
import {ImageCoco} from "../models/coco/imageCoco";
import {ProjectEditedDto} from "../models/projectEditedDto";

@Injectable({
  providedIn: 'root'
})
export class MaskingService {
  public currentProject = environment.project[0].name;
  public currentColor: Color = environment.project[0].colors[0];
  public projectChange: Subject<string> = new Subject<string>();
  public projectEditNameChange: Subject<string> = new Subject<string>();
  public projectEdited: Subject<ProjectEditedDto> = new Subject<ProjectEditedDto>();
  public maskUrl: Subject<string> = new Subject<string>();
  public imageUrl: Subject<string> = new Subject<string>();
  public modal: Subject<string> = new Subject<string>();
  public selectedImageSubject: Subject<string> = new Subject<string>();
  public imageFileDatas: Subject<ImageFileDatas[]> = new Subject<ImageFileDatas[]>();
  public layers: Subject<Annotation[]> = new Subject<Annotation[]>();
  public layerChange: Subject<AnnotationChange> = new Subject<AnnotationChange>();
  public fileContent: Subject<string[]> = new Subject<string[]>();
  public cocoLayer: Subject<AnnotationCocoDto> = new Subject<AnnotationCocoDto>();
  public focusedLayer: Subject<number> = new Subject<number>();
  public savedLayers: Annotation[] = [];
  public selectedImage: string = "";
  public mask: any;
  public fixLayer = false;
  public currentOpacity: number;
  public currentUrl: string = "";
  public currentMaskUrl: string;
  public artboard: any;
  public highestLayerIndex = -1;

  public imgDimensionConfig = {
    "imgs": {
      width: 1250,
      height: 950,
      canvasWidth: 1250,
      canvasHeight: 950
    },
    "imgs2": {
      width: 1928,
      height: 1208,
      canvasWidth: 2014,
      canvasHeight: 1284
    },
    "imgsd": {
      width: 1928,
      height: 1208,
      canvasWidth: 2014,
      canvasHeight: 1284
    }
  };

  public series = "imgs";

  constructor() {
  }

  public setProject(index: number): void {
    this.currentProject = environment.project[index].name;
    this.currentColor = environment.project[index].colors[0];
    this.projectChange.next(this.currentProject);
  }

  public editProjectName(index: number) {
    this.currentProject = environment.project[index].name;
    this.currentColor = environment.project[index].colors[0];
    this.projectEditNameChange.next(this.currentProject);
  }

  public getEditProjectName() {
    return this.projectEditNameChange;
  }

  public getProjectChange() {
    return this.projectChange;
  }

  public setEditedProject(index: number, imageData: ImageFileDatas[], imagesToDeleteWithProject: string[]): void {
    this.currentProject = environment.project[index].name;
    this.currentColor = environment.project[index].colors[0];
    let editedObj = new ProjectEditedDto(this.currentProject, imageData, imagesToDeleteWithProject)
    this.projectEdited.next(editedObj);
  }

  public getEditedProject() {
    return this.projectEdited;
  }


  public setColor(index: number): void {
    let projectIndex = environment.project.findIndex(e => e.name === this.currentProject);
    this.currentColor = environment.project[projectIndex].colors[index];
  }

  public setArtboard(artboard: any): void {
    this.artboard = artboard;
  }

  public getSelectedImageSubject(): Observable<string> {
    return this.selectedImageSubject;
  }

  public getColor(): Color {
    return this.currentColor;
  }

  public setSelectedImage(imageName: string) {
    this.selectedImage = imageName;
    this.selectedImageSubject.next(imageName)
  }

  public getSelectedImage() {
    return this.selectedImage;
  }

  public setFocusedLayer(imageIndex: number) {
    this.focusedLayer.next(imageIndex)
  }

  public getFocusedLayer() {
    return this.focusedLayer;
  }

  public setModal(content: string) {
    this.modal.next(content)
  }

  public getModal() {
    return this.modal;
  }

  public fixLayerType(){
    this.fixLayer = !this.fixLayer;
  }

  public getLayerFix(){
    return this.fixLayer;
  }

  public setImageUrl(url: string): void {
    var series = url.match(/[\w-]+\/[\w-]+\.(png|jpg)$/)[0].split("/")[0];
    this.setDimensions(series);
    if (this.mask && this.mask.dom.children[0].children.length > 0) {
      this.modifyLayer(new AnnotationChange({ index: 0, type: 'clearAll' }));
      this.currentUrl = url;
      this.imageUrl.next(url);
    } else {
      this.currentUrl = url;
      this.imageUrl.next(url);
    }
  }

  public setImageSrc(url: string): void {
    this.modifyLayer(new AnnotationChange({ index: 0, type: 'clearAll' }));
    this.currentUrl = url;
    this.imageUrl.next(url);
  }

  public setImageFileDatas(imageFileDatas: ImageFileDatas[]) {
    this.imageFileDatas.next(imageFileDatas);
  }

  public getImageFileDatas(): Observable<ImageFileDatas[]> {
    return this.imageFileDatas;
  }

  public setUploadedLayers(fileName: string, content: any) {
    this.fileContent.next([fileName, content]);
  }

  public getUploadedLayers() {
    return this.fileContent;
  }

  public setCocoLayer(categoryName : string, annotation: number[], imageName: ImageCoco) {
    let annotationCocoDto = new AnnotationCocoDto(imageName, annotation, categoryName);
    this.cocoLayer.next(annotationCocoDto);
  }

  public getCocoLayer() {
    return this.cocoLayer;
  }

  public setDimensions(series: string): void {
    this.series = series;
  }

  public getDimensions(): void {
    return this.imgDimensionConfig[this.series];
  }

  public getImageUrl(): Observable<string> {
    return this.imageUrl;
  }

  public getCurrentImageUrl(): string {
    return this.currentUrl;
  }

  public setMaskUrl(url: string): void {
    this.currentMaskUrl = url;
    this.maskUrl.next(url);
    this.updateMask(this.mask);
  }

  public getMaskUrl(): Observable<string> {
    return this.maskUrl;
  }

  public updateMask(mask): void {
    this.mask = mask;
    let layers: Annotation[] = [];
    let i = 0;
    if (mask.dom.children[0].children.length > 0) {
      [...mask.dom.children[0].children].forEach(element => {
        if (element.classList[1] === 'completePoly') {
          const color = element.getAttribute('color');
          layers.push(new Annotation({ type: color, index: i.toString(), visibility: element.attributes.visibility.value, id: element.attributes.id.value }))
          this.highestLayerIndex = i;
        }
        i++;
      });
    }
    this.savedLayers = layers;
    this.layers.next(layers);
  }

  public loadedMask(): boolean {
    if (this.mask.dom.children[0].children.length > 0) {
      for (let element of this.mask.dom.children[0].children) {
        if (element.classList[0] === 'existingMask') {
          return true;
        }
      }
    }
    return false;
  }

  public loadedMaskUrl(): string {
    if (this.mask.dom.children[0].children.length > 0) {
      for (let element of this.mask.dom.children[0].children) {
        if (element.classList[0] === 'existingMask') {
          return element.children[0].href.baseVal
        }
      }
    }
  }

  public setLayers(color: string, newColor): void {
    let newLayers: Annotation[] = [];
    for (let layer of this.savedLayers) {
      if (layer.type == color) {
        layer.type = newColor;
        this.modifyLayer(new AnnotationChange(layer));
      }
      newLayers.push(layer);
    }
    this.savedLayers = newLayers;
    this.layers.next(newLayers);
  }

  public getLayers(): Observable<Annotation[]> {
    return this.layers;
  }

  public modifyLayer(change: AnnotationChange): void {
    if (change.type === 'opacity') {
      this.currentOpacity = change.index * .01;
    }
    this.layerChange.next(change);
  }

  public changeEmit(change: AnnotationChange): void {
    this.layerChange.next(change);
  }

  public revert(collection: string): void {
    let req = new AnnotationChange({ type: 'revert', index: 0 }, collection)
    this.layerChange.next(req);
  }

  public getLayerChange(): Observable<AnnotationChange> {
    return this.layerChange;
  }
}
