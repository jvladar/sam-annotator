import {
    Component,
    OnInit,
    ViewChild,
    Renderer2,
    HostListener,
    AfterViewInit,
    Output
} from '@angular/core';
import * as cheerio from 'cheerio';
import * as d3 from 'd3';
import { PanZoomConfig, PanZoomAPI, PanZoomModel } from 'ng2-panzoom';
import {Subscription} from 'rxjs';
import { NgxUiLoaderService } from 'ngx-ui-loader';
import {ActivatedRoute, Router} from '@angular/router';
import { MaskingService } from '../services/masking.service';
import { environment } from 'src/environments/environment';
import {ImageFileDatas} from "../models/imageFileDatas";
import { saveAs } from 'file-saver'
import * as io from 'socket.io-client';
import JSZip from 'jszip';
import {Coco} from "../models/coco/coco";
import {InfoCoco} from "../models/coco/infoCoco";
import {LicenseCoco} from "../models/coco/licenseCoco";
import {UnigueIdGeneratorService} from "../services/unigue-id-generator.service";
import {ImageCoco} from "../models/coco/imageCoco";
import {CategoryCoco} from "../models/coco/categoryCoco";
import {Annotation} from "../models/annotation";
import {AnnotationCoco} from "../models/coco/annotationCoco";
import {DatePipe} from "@angular/common";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";

declare const getImagesMap: (...args: any[]) => Map<string, string>;

enum ActiveMode {
    click_mode,
    all_masks_mode,
    bounding_box_mode,
    default
}

declare var $: any;

@Component({
    selector: 'app-drawing-canvas',
    templateUrl: './main-canvas.component.html',
    styleUrls: ['./main-canvas.component.css']
})
export class MainCanvasComponent implements OnInit, AfterViewInit {

    socket : any;
    activeMode: ActiveMode = ActiveMode.click_mode;

    public dragging = false;
    public drawing = false;
    public startPoint = [];
    public svg;
    public g;
    public points = [];
    public color = '#402020';
    public history = [];
    public svgElement;
    public panzoomConfig: PanZoomConfig = new PanZoomConfig({
        zoomLevels: 10,
        scalePerZoomLevel: 1.5,
        zoomStepDuration: 0.2,
        freeMouseWheel: false,
        invertMouseWheel: true,
        zoomToFitZoomLevelFactor: 0.9,
        dragMouseButton: 'right',
        initialZoomLevel: 1
    });
    public width = 0;
    public projectImageData : ImageFileDatas[] = [];
    public height = 0;
    private startPosX = 0;
    private startPosY = 0;
    public selectedImage = "";
    private panZoomAPI: PanZoomAPI;
    public panzoomModel: PanZoomModel;
    public projectName : string;
    public projectIndex: number;
    private apiSubscription: Subscription;
    private modelChangedSubscription: Subscription;
    public loadedMask = false;
    public imageFileDatas: ImageFileDatas[] = [];
    public previewShown = false;
    public layers: Annotation[];
    @ViewChild('artboard') artboard;
    public opacity: number = 60;
    @ViewChild('imageNumber') imageNumber;
    @ViewChild('url') url;
    @Output() Layers;
    public localStorage = [];
    public closedPolygon = false;
    public mx = 0;
    public my = 0;
    public rectangleModeOn = false;
    public processingImage = false;
    public allMasksFlag = false;
    private closedRectangle = false;

    private dimensions;

    ngAfterViewInit(): void {
        this.maskSvc.setArtboard(this.artboard.nativeElement.innerHTML);
        this.setLayers();
        this.svgElement = this.artboard.nativeElement.children[0];
    }

    constructor(private renderer: Renderer2,
                private ngxService: NgxUiLoaderService,
                private activatedRoute: ActivatedRoute,
                private maskSvc: MaskingService,
                private idGenerator: UnigueIdGeneratorService,
                private datePipe: DatePipe,
                private router: Router) { }

    ngOnInit(): void {
        const storage = Object.entries(localStorage);
        for (const item of storage) {
            if (item[0].includes('github')) {
                item[0] = item[0].match(/[\w-]+\.(png|jpg)/)[0].substring(0, 4);
                this.localStorage.push(item);
            }
        }

        this.projectName = environment.project[0].name;
        this.projectIndex = environment.project.findIndex(e => e.name === this.projectName);

        this.socket = io.connect("http://127.0.0.1:5000",{
            reconnection: false
        });

        this.apiSubscription = this.panzoomConfig.api.subscribe((api: PanZoomAPI) => this.panZoomAPI = api);
        this.modelChangedSubscription = this.panzoomConfig.modelChanged.subscribe((model: PanZoomModel) => {
            this.onModelChanged(model);
            this.panzoomModel = model;
        });

        this.socket.on('show_image', uploaded => {
            this.processingImage = false;
        });

        this.socket.on('masks', masksData => {
            if (this.selectedImage == "") {
                return;
            }
            for (const mask  of masksData) {
                for (let point= 0; point < mask.length; point = point+2) {
                    this.points.push([mask[point],mask[point+1]])
                }
                if (this.allMasksFlag) {
                    let categoryNumber = this.environment.project[this.projectIndex].colors.findIndex(e => e.name === "Nezaradená");
                    if (categoryNumber === -1) {
                        environment.project[this.projectIndex].colors.push({color: '#808080', name: "Nezaradená"})
                        categoryNumber = this.environment.project[this.projectIndex].colors.findIndex(e => e.name === "Nezaradená");
                    }
                    this.maskSvc.setColor(categoryNumber);
                }
                this.closePolygon()
            }
            this.closedRectangle = false;
            this.allMasksFlag = false;
        });

        this.maskSvc.getLayers().subscribe(layers => {
            this.layers = layers
        })

        this.dimensions = this.maskSvc.getDimensions();

        this.svg = d3.select('.artboard').append('svg')
            .attr('background-size', '1000px '+ '1000px')
            .attr('height', 1000)
            .attr('width', 1000);


        // nepouziva sa
        this.maskSvc.getImageUrl().subscribe(url => {
            this.updateCanvas();
            if (this.maskSvc.getSelectedImage() == ""){
                this.svg.style('background-image', `url('${url}')`);
            }
        })

        this.maskSvc.getSelectedImageSubject().subscribe(url => {
            this.selectedImage = url;
        })

        this.maskSvc.getEditProjectName().subscribe(name => {
            this.projectName = name;
        })

        this.maskSvc.getProjectChange().subscribe(name => {
            this.projectName = name;
            this.projectIndex = environment.project.findIndex(e => e.name === this.projectName);
            this.maskSvc.setSelectedImage("");
            this.maskSvc.setImageFileDatas(this.imageFileDatas);
            this.layersVisibilityForImage()
        })

        this.maskSvc.getEditedProject().subscribe(data => {
            this.projectName = data.name;
            this.projectIndex = environment.project.findIndex(e => e.name === this.projectName);
            this.maskSvc.setSelectedImage("");
            this.maskSvc.setImageFileDatas(data.imageFileDatas);
            this.deleteProjectData(data.imagesToDeleteWithProject);
        })

        this.maskSvc.getImageFileDatas().subscribe(urlsData => {
            this.imageFileDatas = urlsData;
            this.projectImageData = this.imageFileDatas.filter( image => image.projectName == this.projectName);
            if (this.projectImageData.length == 0) {
                this.width = 1000
                this.height = 1000;
                this.svg = d3.select('.artboard').select('svg')
                    .attr('height', this.height)
                    .attr('width', this.width);
                this.svg.style('background-size', '100% ' + '100%');
                this.svg.style('background-image', ``);
            }
            else if (this.maskSvc.getSelectedImage() === "") {
                this.changeImage(this.projectImageData[0])
                this.layersVisibilityForImage()
            }
        })

        this.maskSvc.getUploadedLayers().subscribe(content => {
            this.projectImageData = this.imageFileDatas.filter( image => image.projectName == this.projectName);
            this.importYolo(content);
        })

        this.maskSvc.getCocoLayer().subscribe(cocoLayerDto => {
            const selectedImage = this.maskSvc.getSelectedImage();
            this.maskSvc.setSelectedImage(cocoLayerDto.imageName.file_name);
            let imageFile = this.projectImageData.filter( x => x.name == cocoLayerDto.imageName.file_name);
            if (imageFile.length > 0) {
                const width = cocoLayerDto.imageName.width;
                let resizeEdit = width / 1000;
                const categoryNumber = this.environment.project[this.projectIndex].colors.findIndex(e => e.name === cocoLayerDto.categoryName);
                for (let point= 0; point < cocoLayerDto.annotation.length; point = point + 2) {
                    this.points.push([cocoLayerDto.annotation[point] * resizeEdit, cocoLayerDto.annotation[point+1] * resizeEdit])
                }
                this.maskSvc.setColor(categoryNumber)
                this.closePolygon()
                this.maskSvc.setSelectedImage(selectedImage);
                this.layersVisibilityForImage()
            }
        })

        this.maskSvc.getLayerChange().subscribe(obj => {
            if (obj.type === 'opacity') {
                this.svg.selectAll('.completePoly').attr('opacity', obj.index * .01);
                this.opacity = obj.index;
            }
            if (this.previewShown) {
                return;
            }
            if (obj.type === 'delete') {
                this.deleteLayer(obj.index);
            }
            if (obj.type === 'rectangleMode') {
                this.changeRectangleMode();
            }
            if (obj.type === 'up') {
                this.toFront(obj.index);
            }
            if (obj.type === 'down') {
                this.toBottom(obj.index);
            }
            if (obj.type === 'toggle') {
                this.toggleVisibility(obj.index);
            }
            if (obj.type === 'clearAll') {
                this.deleteAllLayers();
            }
            if (obj.type === 'toggleAll') {
                this.toggleAll();
            }
            if (environment.project[this.projectIndex].colors.map(e => e.color).includes(obj.type)) {
                this.updateColor(obj.index, obj.type);
            }
            if (obj.type === 'yolo') {
                if (this.projectImageData.length > 0) {
                    this.exportToYolo(this.selectedImage);
                }
            }
            if (obj.type === 'yolo-all') {
                if (this.projectImageData.length > 0) {
                    this.exportToYoloAll();
                }
            }
            if (obj.type === 'coco') {
                if (this.projectImageData.length > 0) {
                    this.exportToCoco();
                }
            }
            if (obj.type === 'coco-all') {
                if (this.projectImageData.length > 0) {
                    this.exportToCocoAll();
                }
            }
            if (obj.type === 'addToLocalStorage') {
                this.addToLocalStorage();
            }
            if (obj.type === 'revert') {
                this.revertFromLocalStorage(obj.collection);
            }
            this.setLayers();
        })


        this.maskSvc.getMaskUrl().subscribe(url => {
            this.loadedMask = true;
            this.svg.selectAll('.existingMask').remove();
            const g = this.svg.append('g').attr('class', 'existingMask' + ' completePoly').attr('layerHidden', 'false')
                .attr('color', 'existingMask')
                .attr('opacity', this.opacity * .01)
                .attr('visibility', 'visible');
            g.append('svg:image')
                .attr('href', url)
                .attr('x', 43)
                .attr('y', 38);
        })
    }


    private updateCanvas(): void {
        this.dimensions = this.maskSvc.getDimensions();
        if (this.dimensions) {
            this.svg = d3.select('.artboard').select('svg')
                .attr('height', this.dimensions.canvasHeight)
                .attr('width', this.dimensions.canvasWidth);
            this.svg.style('background-size', '100% ' + '100%');
        }
    }

    public changeImage(imageData: any){
        if (!this.processingImage) {
            this.svg = d3.select('.artboard').select('svg')
                        .attr('height', imageData.height + 'px')
                        .attr('width', 1000 + 'px');
            this.svg.style('background-size', '100% ' + '100%');
            this.maskSvc.setSelectedImage(imageData.name);
            this.layersVisibilityForImage()
            this.svg.style('background-image', `url('${imageData.data}')`);
            this.socket.emit('set_image', {'image': imageData.data, 'image_name': imageData.name});
            this.defaultModeOn();
            this.processingImage = true;
        }
    }

    public deleteSelectedImage(imageName : any) {
        var fd = this.imageFileDatas.filter(x => x.name != imageName)
        var children = this.svgElement.children;
        for (var i = 0; i < children.length; i++) {
            if (children[i].id === imageName){
                this.svgElement.removeChild(children[i]);
                i--;
            }
        }
        if(imageName === this.maskSvc.getSelectedImage()) {
            this.svg.style('background-image', ``);
            this.layersVisibilityForImage()
        }
        this.maskSvc.setSelectedImage("");
        this.maskSvc.setImageFileDatas(fd);
    }

    public changeImageShowSam(imageData: any){
        /*this.svg = d3.select('.artboard').select('svg')
            .attr('height', imageData.height + 'px')
            .attr('width', 1000 + 'px');
        this.svg.style('background-size', '100% ' + '100%');
        this.layersVisibilityForImage();
        this.svg.style('background-image', `url('${imageData}')`);*/
    }

    public deleteProjectData(imageNames: string[]) {
        for (let imageName of imageNames) {
            var children = this.svgElement.children;
            for (var i = 0; i < children.length; i++) {
                if (children[i].id === imageName){
                    this.svgElement.removeChild(children[i]);
                    i--;
                }
            }
        }
    }

    getFileBaseName(fileName: string): string {
        // Extract the base name of the file without the extension using a regular expression
        const matches = fileName.match(/(.*)\.[^.]+$/);
        if (matches && matches.length > 1) {
            return matches[1];
        } else {
            return fileName; // Return the original file name if no extension found
        }
    }

    public importYolo(content: any) {
        const fileName = this.getFileBaseName(content[0]);
        const selectedImage = this.maskSvc.getSelectedImage();
        const lines = content[1].split('\n');
        let imageFile = this.projectImageData.filter( x => this.getFileBaseName(x.name) == fileName);
        this.maskSvc.setSelectedImage(imageFile[0].name);
        if (imageFile.length > 0) {
            const height = imageFile[0].height;
            const width = imageFile[0].width;
            for (const line of lines) {
                const values = line.split(' ').map((value) => parseFloat(value.trim()));
                const lineNumber = values[0];
                const doubles = values.slice(1);
                if (line.length > 0) {
                    for (let point= 0; point < doubles.length; point = point + 2) {
                        this.points.push([doubles[point] * width, doubles[point+1] * height])
                    }
                    this.maskSvc.setColor(lineNumber)
                    this.closePolygon()
                }
            }
            if (selectedImage != "") {
                this.maskSvc.setSelectedImage(selectedImage);
            }
        }
        this.changeImage(this.projectImageData[0])
        this.layersVisibilityForImage()
    }


    public changeFromGoogle() {
        document.getElementById("signout_button").style.visibility = "visible";
        let a = document.getElementById("image") as HTMLImageElement;
        let imagesMap: Map<string, string> = getImagesMap();
        let loadedImagesCount = 0; // Counter for loaded images
        let totalImages = imagesMap.size; // Total number of images
        let imageFileDatas: ImageFileDatas[] = []; // Array to hold processed image data

        imagesMap.forEach((value, key) => {
            let imageFile: ImageFileDatas = new ImageFileDatas();
            var image = new Image();
            image.src = value;
            image.onload = () => {
                imageFile.width = 1000;
                imageFile.height = image.height / image.width * 1000;
                imageFile.projectName = this.projectName;
                imageFile.id = this.idGenerator.generateUniqueId();

                // Add image file data to the array
                imageFile.data = value;
                imageFile.name = key;
                imageFileDatas.push(imageFile);

                // Increment loaded images count
                loadedImagesCount++;

                // Check if all images are loaded
                if (loadedImagesCount === totalImages) {
                    // All images are loaded, call setImageFileDatas
                    this.maskSvc.setImageFileDatas(imageFileDatas);
                }
            };
        });
    }

    private setLayers(): void {
        this.maskSvc.updateMask({ d3: this.svg, dom: this.artboard.nativeElement, loadedMask: this.loadedMask });
    }

    clickModeOn() {
        if (!this.processingImage && !this.allMasksFlag) {
            this.activeMode = ActiveMode.click_mode;
        }
    }

    defaultModeOn(){
        this.activeMode = ActiveMode.default;
    }

    boundingBoxModeOn() {
        if (!this.processingImage && !this.allMasksFlag) {
            this.activeMode = ActiveMode.bounding_box_mode
        }
    }

    // vsade dat kde nieco upravujem a pridavam, na kazdu jednu zmenu
    public addToLocalStorage(): void {
        const collection = this.artboard.nativeElement.innerHTML;
        const contents = JSON.stringify({
            artboard: JSON.stringify(collection),
            url: this.maskSvc.currentUrl,
            opacity: this.opacity
        });
        localStorage.setItem(this.maskSvc.currentUrl, contents);
    }

    public revertFromLocalStorage(collection: string): void {
        this.deleteAllLayers();
        const contents = JSON.parse(collection);
        this.artboard.nativeElement.innerHTML = JSON.parse(contents.artboard);
        this.svg = d3.select('svg');
        this.maskSvc.currentUrl = contents.url;
        this.enableDragging();
        this.setLayers();
        this.loadedMask = this.maskSvc.loadedMask();
        this.svgElement = this.artboard.nativeElement.children[0];
    }

    clickOnImage(event: any) {
        if (this.activeMode === ActiveMode.click_mode && !this.processingImage && this.selectedImage != "") {
            this.socket.emit('click', { 'x': event.offsetX, 'y': event.offsetY });
        }
    }

    getAllMasks() {
        if (this.selectedImage == "") {
            this.maskSvc.setModal("Nahrajte obrázok alebo vyberte obrázok z bočného menu");
            return;
        }
        if (!this.processingImage) {
            this.activeMode = ActiveMode.all_masks_mode;
            this.allMasksFlag = true;
            this.socket.emit('multimask');
        }
    }

    public getRandomInt(max) {
        return Math.floor(Math.random() * max);
    }

    private deleteLayerClick(e): void {
        if (e.target.tagName === 'polygon') {
            e.target.parentNode.remove();
        }
        this.setLayers();
    }

    public mouseUp(e) {
        if (this.selectedImage == "") {
            this.maskSvc.setModal("Nahrajte obrázok alebo vyberte obrázok z bočného menu");
            return
        }

        if(!this.drawing && e.altKey) {
            this.deleteLayerClick(e);
            return;
        }

        if (this.g) {
            this.addToHistory(this.drawing, this.startPoint, this.points);
        }
        this.g = this.svg.select('g.drawPoly');
        if (e.button !== 0) { return; }
        if (this.dragging) { return; }
        if (this.previewShown) { return; }
        this.drawing = true;
        this.startPoint = [(e.layerX - this.panzoomModel.pan.x) *
        (1 / (this.artboard.nativeElement.getBoundingClientRect().width / this.artboard.nativeElement.offsetWidth)),
            (e.layerY - this.panzoomModel.pan.y) *
            (1 / (this.artboard.nativeElement.getBoundingClientRect().width / this.artboard.nativeElement.offsetWidth))];
        if (this.svg.select('g.drawPoly').empty()) {
            this.g = this.svg.append('g').attr('class', 'drawPoly');
            this.svg.selectAll('circle').attr('cursor', 'default');
        }
        if (e.toElement.tagName === 'circle') {
            this.setLayerType();
            return;
        }

        this.closedPolygon = false;
        this.g.select('line').remove();

        if (this.panzoomModel.zoomLevel === 0) {
            this.panzoomModel.zoomLevel = 1;
        }
        if (this.activeMode === ActiveMode.default) {
            if (this.rectangleModeOn && this.points.length == 1) {
                let x = (e.layerX - this.panzoomModel.pan.x) * (1 / (this.artboard.nativeElement.getBoundingClientRect().width / this.artboard.nativeElement.offsetWidth))
                let y = (e.layerY - this.panzoomModel.pan.y) * (1 / (this.artboard.nativeElement.getBoundingClientRect().width / this.artboard.nativeElement.offsetWidth))

                // 2
                this.points.push([x, this.points[0][1]])

                this.svg.select('g.drawPoly').append('polyline')
                    .attr('points', this.points)
                    .style('fill', 'none')
                    .attr('stroke-width', 1 / (this.panzoomModel.zoomLevel / 2))
                    .attr('stroke', '#000');

                this.svg.select('g.drawPoly').append('circle')
                    .attr('cx', this.points[this.points.length - 1][0])
                    .attr('cy', this.points[this.points.length - 1][1])
                    .attr('r', 4 / (this.panzoomModel.zoomLevel / 1.5))
                    .attr('stroke-width', 1 / (this.panzoomModel.zoomLevel / 2))
                    .attr('fill', this.maskSvc.currentColor.color)
                    .attr('stroke', '#000')
                    .attr('is-handle', 'true')
                    .attr('class', 'inProgressCircle')
                    .attr('style', 'cursor:pointer');

                // 3
                this.points.push([x,y]);

                this.svg.select('g.drawPoly').append('polyline').attr('points', this.points)
                    .style('fill', 'none')
                    .attr('stroke-width', 1 / (this.panzoomModel.zoomLevel / 2))
                    .attr('stroke', '#000');

                this.svg.select('g.drawPoly').append('circle')
                    .attr('cx', this.points[this.points.length - 1][0])
                    .attr('cy', this.points[this.points.length - 1][1])
                    .attr('r', 4 / (this.panzoomModel.zoomLevel / 1.5))
                    .attr('stroke-width', 1 / (this.panzoomModel.zoomLevel / 2))
                    .attr('fill', this.maskSvc.currentColor.color)
                    .attr('stroke', '#000')
                    .attr('is-handle', 'true')
                    .attr('class', 'inProgressCircle')
                    .attr('style', 'cursor:pointer');

                // 4
                this.points.push([this.points[0][0], y])

                this.svg.select('g.drawPoly').append('polyline').attr('points', this.points)
                    .style('fill', 'none')
                    .attr('stroke-width', 1 / (this.panzoomModel.zoomLevel / 2))
                    .attr('stroke', '#000');

                this.svg.select('g.drawPoly').append('circle')
                    .attr('cx', this.points[this.points.length - 1][0])
                    .attr('cy', this.points[this.points.length - 1][1])
                    .attr('r', 4 / (this.panzoomModel.zoomLevel / 1.5))
                    .attr('stroke-width', 1 / (this.panzoomModel.zoomLevel / 2))
                    .attr('fill', this.maskSvc.currentColor.color)
                    .attr('stroke', '#000')
                    .attr('is-handle', 'true')
                    .attr('class', 'inProgressCircle')
                    .attr('style', 'cursor:pointer');

                this.setLayerType(true);

            } else {
                this.points.push([
                    (e.layerX - this.panzoomModel.pan.x) * (1 / (this.artboard.nativeElement.getBoundingClientRect().width / this.artboard.nativeElement.offsetWidth)),
                    (e.layerY - this.panzoomModel.pan.y) * (1 / (this.artboard.nativeElement.getBoundingClientRect().width / this.artboard.nativeElement.offsetWidth))
                ]);

                this.svg.select('g.drawPoly').append('polyline').attr('points', this.points)
                    .style('fill', 'none')
                    .attr('stroke-width', 1 / (this.panzoomModel.zoomLevel / 2))
                    .attr('stroke', '#000');

                this.svg.select('g.drawPoly').append('circle')
                    .attr('cx', this.points[this.points.length - 1][0])
                    .attr('cy', this.points[this.points.length - 1][1])
                    .attr('r', 4 / (this.panzoomModel.zoomLevel / 1.5))
                    .attr('stroke-width', 1 / (this.panzoomModel.zoomLevel / 2))
                    .attr('fill', this.maskSvc.currentColor.color)
                    .attr('stroke', '#000')
                    .attr('is-handle', 'true')
                    .attr('class', 'inProgressCircle')
                    .attr('style', 'cursor:pointer');
            }
        } else {
            if (this.activeMode != ActiveMode.bounding_box_mode || this.processingImage) {
                this.drawing = false;
                return;
            }
            if ((this.activeMode === ActiveMode.bounding_box_mode) && this.points.length == 1) {
                let x = (e.layerX - this.panzoomModel.pan.x) * (1 / (this.artboard.nativeElement.getBoundingClientRect().width / this.artboard.nativeElement.offsetWidth))
                let y = (e.layerY - this.panzoomModel.pan.y) * (1 / (this.artboard.nativeElement.getBoundingClientRect().width / this.artboard.nativeElement.offsetWidth))

                // 2
                this.points.push([x, this.points[0][1]])

                this.svg.select('g.drawPoly').append('polyline')
                    .attr('points', this.points)
                    .style('fill', 'none')
                    .attr('stroke-width', 1 / (this.panzoomModel.zoomLevel / 2))
                    .attr('stroke', '#000');

                // 3
                this.points.push([x,y]);

                this.svg.select('g.drawPoly').append('polyline').attr('points', this.points)
                    .style('fill', 'none')
                    .attr('stroke-width', 1 / (this.panzoomModel.zoomLevel / 2))
                    .attr('stroke', '#000');

                this.svg.select('g.drawPoly').append('circle')
                    .attr('cx', this.points[this.points.length - 1][0])
                    .attr('cy', this.points[this.points.length - 1][1])
                    .attr('r', 4 / (this.panzoomModel.zoomLevel / 1.5))
                    .attr('stroke-width', 1 / (this.panzoomModel.zoomLevel / 2))
                    .attr('fill', this.maskSvc.currentColor.color)
                    .attr('stroke', '#000')
                    .attr('is-handle', 'true')
                    .attr('class', 'inProgressCircle')
                    .attr('style', 'cursor:pointer');

                // 4
                this.points.push([this.points[0][0], y])

                this.svg.select('g.drawPoly').append('polyline').attr('points', this.points)
                    .style('fill', 'none')
                    .attr('stroke-width', 1 / (this.panzoomModel.zoomLevel / 2))
                    .attr('stroke', '#000');
                if (this.startPosX < x && this.startPosY < y) {
                    this.socket.emit('boundingbox', { 'x': this.startPosX, 'y': this.startPosY, 'x1': x, 'y1': y });
                }
                else if (this.startPosX > x && this.startPosY < y) {
                    this.socket.emit('boundingbox', { 'x': x, 'y': this.startPosY, 'x1': this.startPosX, 'y1': y });
                }
                else if (this.startPosX > x && this.startPosY > y) {
                    this.socket.emit('boundingbox', { 'x': x, 'y': y, 'x1': this.startPosX, 'y1': this.startPosY  });
                }
                else if (this.startPosX < x && this.startPosY > y) {
                    this.socket.emit('boundingbox', { 'x': this.startPosX, 'y': y, 'x1': x, 'y1': this.startPosY  });
                }
                this.closedRectangle = true;
                this.setLayerType(true);
                this.points = [];
            } else {

                this.startPosX = (e.layerX - this.panzoomModel.pan.x) * (1 / (this.artboard.nativeElement.getBoundingClientRect().width / this.artboard.nativeElement.offsetWidth));
                this.startPosY= (e.layerY - this.panzoomModel.pan.y) * (1 / (this.artboard.nativeElement.getBoundingClientRect().width / this.artboard.nativeElement.offsetWidth));

                this.points.push([this.startPosX, this.startPosY]);

                this.svg.select('g.drawPoly').append('polyline').attr('points', this.points)
                    .style('fill', 'none')
                    .attr('stroke-width', 1 / (this.panzoomModel.zoomLevel / 2))
                    .attr('stroke', '#000');

                this.svg.select('g.drawPoly').append('circle')
                    .attr('cx', this.points[this.points.length - 1][0])
                    .attr('cy', this.points[this.points.length - 1][1])
                    .attr('r', 4 / (this.panzoomModel.zoomLevel / 1.5))
                    .attr('stroke-width', 1 / (this.panzoomModel.zoomLevel / 2))
                    .attr('fill', this.maskSvc.currentColor.color)
                    .attr('stroke', '#000')
                    .attr('is-handle', 'true')
                    .attr('class', 'inProgressCircle')
                    .attr('style', 'cursor:pointer');
            }
        }
    }

    public setLayerType(line? : boolean) {
        this.drawing = false;
        if (!line){
            const g = d3.select('g.drawPoly');
            g.append('line')
                .attr('x1', this.startPoint[0])
                .attr('y1', this.startPoint[1])
                .attr('x2', this.points[0][0])
                .attr('y2', this.points[0][1])
                .attr('stroke', '#53DBF3')
                .attr('stroke-width', 1 / (this.panzoomModel.zoomLevel / 2));
        }
        if (this.activeMode === ActiveMode.default) {
            this.mx = this.points[0][0];
            this.my = this.points[0][1];
            if (this.maskSvc.getLayerFix()) {
                this.closePolygon();
            } else {
                this.closedPolygon = true;
            }
        }
    }

    public setColor(i: number) {
        this.maskSvc.setColor(i);
        this.closedPolygon = false;
        this.closePolygon();
    }

    public findIndexInParentDiv(gElement) {
        var parentDiv = gElement.parentElement;
        var gElements = parentDiv.getElementsByTagName('g');
        for (var i = 0; i < gElements.length; i++) {
            if (gElements[i] === gElement) {
                return i;
            }
        }
        return -1;
    }

    public closePolygon(childPoly?: boolean) {
        let child = '';
        if (childPoly) {
            child = ' child';
        }
        this.svg.selectAll('circle').attr('cursor', 'move');
        this.svg.select('g.drawPoly').remove();

        const g = this.svg.append('g').attr('class', this.maskSvc.currentColor.color + ' completePoly' + child)
            .attr('layerHidden', 'false')
            .attr("id", this.maskSvc.getSelectedImage())
            .attr('color', this.maskSvc.currentColor.color)
            .attr('opacity', this.opacity * .01)
            .attr('visibility', 'visible')
            .classed("polygon", true);

        const holder = this;

        g.append('polygon')
            .attr('points', this.points)
            .attr("cx", 50)
            .attr("cy", 50)
            .attr('cursor', 'move')
            .attr('is-handle', 'true')
            .attr("stroke", "#039BE5")
            .attr("stroke-width", "1px")
            .style('fill', this.maskSvc.currentColor.color)

        if (this.panzoomModel.zoomLevel === 0) {
            this.panzoomModel.zoomLevel = 1;
        }

        if (this.activeMode === ActiveMode.default) {
            if(!this.rectangleModeOn) {
                for (const point of this.points) {
                    g.selectAll('circles')
                        .data([point])
                        .enter()
                        .append('circle')
                        .attr('cx', point[0])
                        .attr('cy', point[1])
                        .attr('r', 4 / this.panzoomModel.zoomLevel)
                        .attr('stroke-width', 1 / (this.panzoomModel.zoomLevel / 2))
                        .attr('fill', '#FDBC07')
                        .attr('stroke', '#000')
                        .attr('is-handle', 'true')
                        .attr('class', 'dragCircle')
                        .attr('cursor', 'move')
                        .call(d3.drag()
                            .on('drag', function () {
                                holder.handleDrag(this);
                            })
                            .on('end', () => {
                                this.dragging = false;
                                //this.addToHistory(this.drawing, this.startPoint, this.g, this.points);
                            })
                        );
                }
            } else {
                // chcem len stvorec s dvoma bodmi, manualne anotacie
                let points = [this.points[0],this.points[2]]
                for (const point of points) {
                    g.selectAll('circles')
                        .data([point])
                        .enter()
                        .append('circle')
                        .attr('cx', point[0])
                        .attr('cy', point[1])
                        .attr("width", 5)
                        .attr("height", 5)
                        .attr('r', 4 / this.panzoomModel.zoomLevel)
                        .attr('stroke-width', 1 / (this.panzoomModel.zoomLevel / 2))
                        .attr('fill', '#FDBC07')
                        .attr('stroke', '#000')
                        .attr('is-handle', 'true')
                        .attr('class', 'dragCircle')
                        .attr('cursor', 'move')
                        .call(d3.drag()
                            .on('drag', function () {
                                holder.handleDrag(this, true)
                            })
                            .on('end', () => {
                                this.dragging = false;
                            })
                        );
                }
            }
        } else if (this.activeMode === ActiveMode.bounding_box_mode && !this.closedRectangle) {
            let points = [this.points[0],this.points[2]]
            for (const point of points) {
                g.selectAll('circles')
                    .data([point])
                    .enter()
                    .append('circle')
                    .attr('cx', point[0])
                    .attr('cy', point[1])
                    .attr("width", 5)
                    .attr("height", 5)
                    .attr('r', 4 / this.panzoomModel.zoomLevel)
                    .attr('stroke-width', 1 / (this.panzoomModel.zoomLevel / 2))
                    .attr('fill', '#FDBC07')
                    .attr('stroke', '#000')
                    .attr('is-handle', 'true')
                    .attr('class', 'dragCircle')
                    .attr('cursor', 'move')
            }
        } else {
            for (const point of this.points) {
                g.selectAll('circles')
                    .data([point])
                    .enter()
                    .append('circle')
                    .attr('cx', point[0])
                    .attr('cy', point[1])
                    .attr('r', 4 / this.panzoomModel.zoomLevel)
                    .attr('stroke-width', 1 / (this.panzoomModel.zoomLevel / 2))
                    .attr('fill', '#FDBC07')
                    .attr('stroke', '#000')
                    .attr('is-handle', 'true')
                    .attr('class', 'dragCircle')
                    .attr('cursor', 'move')
                    .call(d3.drag()
                        .on('drag', function () {
                            holder.handleDrag(this);
                        })
                        .on('end', () => {
                            this.dragging = false;
                        })
                    );
            }
        }


        g.datum({x: 0, y: 0}).call(d3.drag()
            .on("drag", function(d) {
                holder.dragBody(this, d);
            })
            .on('end', () => {
                this.dragging = false;
            })
        );


        this.points.splice(0);
        this.drawing = false;
        this.setLayers();
    }

    public dragBody(e,d) {
        this.maskSvc.setFocusedLayer(this.findIndexInParentDiv(e));
        let circle;
        this.dragging = true;
        const circles = d3.select(e).selectAll('circle');
        let moveX = d3.event.x;
        let moveY = d3.event.y;
        let transform = true;
        for (const circleGroup of circles._groups[0]) {
            circle = d3.select(circleGroup)
            let cx = Number(circle.attr('cx'));
            let cy = Number(circle.attr('cy'));
            if ( (cx + moveX) > this.artboard.nativeElement.offsetWidth-5 || (cy + moveY) > this.artboard.nativeElement.offsetHeight-5) {
                transform = false;
            }
            if ( (cx + moveX) <= 0 || (cy + moveY) <= 0) {
                transform = false;
            }
        }
        if (transform) {
            d3.select(e).attr("transform", "translate(" + (d.x = moveX) + "," + (d.y = moveY) + ")")
        }
    }

    public enableDragging() {
        const holder = this;
        this.svg.selectAll('.dragCircle').call(d3.drag()
            .on('drag', function () {
                holder.handleDrag(this);
            })
            .on('end', () => {
                this.dragging = false;
                //this.addToHistory(this.drawing, this.startPoint, this.g, this.points);
            })
        );

        this.svg.selectAll('polygon').datum({x: 0, y: 0}).call(d3.drag()
            .on("drag", function(d) {
                holder.dragBody(this, d);
            })
            .on('end', () => {
                this.dragging = false;
                //this.addToHistory(this.drawing, this.startPoint, this.g, this.points);
            })
        );
    }

    public mouseMove(e) {
        if (!this.drawing) { return; }
        const g = d3.select('g.drawPoly');
        if (e.target.tagName === 'line') { return; }
        if (e.target.className.baseVal === 'inProgressCircle') {
            g.select('line').attr('stroke-width', 1 / (this.panzoomModel.zoomLevel / 2));
            return;
        }

        if (this.activeMode === ActiveMode.default) {
            if (this.rectangleModeOn) {
                let x = (e.layerX - this.panzoomModel.pan.x) * (1 / (this.artboard.nativeElement.getBoundingClientRect().width / this.artboard.nativeElement.offsetWidth))
                let y = (e.layerY - this.panzoomModel.pan.y) * (1 / (this.artboard.nativeElement.getBoundingClientRect().width / this.artboard.nativeElement.offsetWidth))

                let points = [
                    [x, y],
                    [x, this.points[0][1]],
                    [this.points[0][0], this.points[0][1]],
                    [this.points[0][0], y],
                    [x, y]
                ];
                g.select('polyline').remove();
                g.append('polyline')
                    .attr('points', points)
                    .style('fill', 'none')
                    .attr('stroke-width', 1 / (this.panzoomModel.zoomLevel / 2))
                    .attr('stroke', '#000');
            } else {
                g.select('line').remove();
                g.append('line')
                    .attr('x1', this.startPoint[0])
                    .attr('y1', this.startPoint[1])
                    .attr('x2', (e.layerX - this.panzoomModel.pan.x) *
                        (1 / (this.artboard.nativeElement.getBoundingClientRect().width / this.artboard.nativeElement.offsetWidth)))
                    .attr('y2', (e.layerY - this.panzoomModel.pan.y) *
                        (1 / (this.artboard.nativeElement.getBoundingClientRect().width / this.artboard.nativeElement.offsetWidth)))
                    .attr('stroke', '#53DBF3')
                    .attr('stroke-width', 1 / (this.panzoomModel.zoomLevel * 1.3));
            }
        } else if (this.activeMode === ActiveMode.bounding_box_mode) {
            let x = (e.layerX - this.panzoomModel.pan.x) * (1 / (this.artboard.nativeElement.getBoundingClientRect().width / this.artboard.nativeElement.offsetWidth))
            let y = (e.layerY - this.panzoomModel.pan.y) * (1 / (this.artboard.nativeElement.getBoundingClientRect().width / this.artboard.nativeElement.offsetWidth))

            let points = [
                [x,y],
                [x,this.points[0][1]],
                [this.points[0][0],this.points[0][1]],
                [this.points[0][0],y],
                [x,y]
            ];
            g.select('polyline').remove();
            g.append('polyline')
                .attr('points', points)
                .style('fill', 'none')
                .attr('stroke-width', 1 / (this.panzoomModel.zoomLevel / 2))
                .attr('stroke', '#000');
        }
    }

    public handleDrag(e, rectOn?: boolean) {
        if (this.drawing) { return; }
        this.maskSvc.setFocusedLayer(this.findIndexInParentDiv(e.parentNode));
        const newPoints = [];
        let circle;
        this.dragging = true;
        const poly = d3.select(e.parentNode).select('polygon');
        let xTr = d3.select(e.parentNode).data()[0].x;
        let yTr = d3.select(e.parentNode).data()[0].y;
        const circles = d3.select(e.parentNode).selectAll('circle');
        e.setAttribute('cy', yTr > (0-d3.event.y) ? Math.min(d3.event.y, this.artboard.nativeElement.offsetHeight-5+(-yTr)) : -yTr);
        e.setAttribute('cx', xTr > (0-d3.event.x) ? Math.min(d3.event.x,this.artboard.nativeElement.offsetWidth-5+(-xTr)) : -xTr);
        for (const circleGroup of circles._groups[0]) {
            circle = d3.select(circleGroup);
            newPoints.push([circle.attr('cx'),circle.attr('cy')]);
        }
        if(rectOn){
            let newRect = [
                newPoints[0],
                [newPoints[0][0],newPoints[1][1]],
                newPoints[1],
                [newPoints[1][0],newPoints[0][1]]
            ]
            poly.attr('points', newRect);
        } else {
            poly.attr('points', newPoints);
        }
    }

    public changeRectangleMode(){
        this.rectangleModeOn = !this.rectangleModeOn;
    }


    public updateImage(url?): void {
        if (url) {
            this.svg.style('background-image', `url('${url}')`);
        } else {
            this.svg.style('background-image', `url('${this.url.nativeElement.value}')`);
            this.imageNumber.nativeElement.value = this.url.nativeElement.value.match(/[\w-]+\.(png|jpg)/)[0].substring(0, 4);
        }
    }

    onModelChanged(model: PanZoomModel): void {
        if (this.artboard && model.zoomLevel >= 1) {
            this.svg.selectAll('circle').attr('r', 4 / (model.zoomLevel / 1.5));
            this.svg.selectAll('polyline').attr('stroke-width', 1 / (model.zoomLevel / 2));
            this.svg.selectAll('circle').attr('stroke-width', 1 / (model.zoomLevel / 2));
        }
    }

    public addToHistory(drawing, startPoint, points): void {
        //const collection = this.svg;
        this.history.unshift([JSON.stringify(drawing),
            JSON.stringify(startPoint), JSON.stringify(points)]);
        if (this.history.length > 15) {
            this.history.pop();
        }
    }

    public undo(): void {
        if (this.history.length > 0 && this.drawing) {
            //this.svg = this.history[0][0]
            this.drawing = JSON.parse(this.history[0][0]);
            this.startPoint = JSON.parse(this.history[0][1]);
            this.points = JSON.parse(this.history[0][2]);
            this.history.shift();
            this.svg.select('g.drawPoly').selectAll('polyline:last-of-type').remove();
            this.svg.select('g.drawPoly').selectAll('circle:last-of-type').remove();
        }
        //this.enableDragging();
    }

    public toFront(i: number) {
        this.svgElement.append(this.svgElement.children[i]);
    }

    public toBottom(i: number) {
        this.svgElement.prepend(this.svgElement.children[i]);
    }

    public updateColor(i: number, color: string) {
        this.svgElement.children[i].children[0].setAttribute('style', 'fill: ' + color + ';');
        this.svgElement.children[i].setAttribute('color', color);
    }

    public toggleVisibility(i: number) {
        if (this.svgElement.children[i].getAttribute('visibility') !== 'hidden') {
            this.svgElement.children[i].setAttribute('visibility', 'hidden');
            this.svgElement.children[i].setAttribute('layerHidden', 'true');
            return;
        }
        this.svgElement.children[i].setAttribute('visibility', 'visible');
        this.svgElement.children[i].setAttribute('layerHidden', 'false');
        this.setLayers();
    }

    public layersVisibilityForImage() {
        for (let layer of this.svgElement.children) {
            if (layer.getAttribute('id') != this.maskSvc.getSelectedImage()) {
                layer.setAttribute('visibility', 'hidden');
            } else {
                layer.setAttribute('visibility', 'visible');
            }
        }
        this.setLayers();
    }

    public toggleAll(): void {
        if (this.svgElement.children.length > 0) {
            if (this.getVisibility(0)) {
                for (const layer of this.svgElement.children) {
                    if (layer.classList.contains('completePoly')) {
                        layer.setAttribute('visibility', 'hidden');
                        layer.setAttribute('layerHidden', 'true');
                    }
                }
            } else {
                for (const layer of this.svgElement.children) {
                    layer.setAttribute('visibility', 'visible');
                    layer.setAttribute('layerHidden', 'false');
                }
            }
        }
    }

    public toggleControlPoints(): void {
        if (this.svgElement.classList.contains('hideCircles')) {
            this.svgElement.classList.remove('hideCircles');
        } else {
            this.svgElement.classList.add('hideCircles');
        }
    }

    public getVisibility(i: number): boolean {
        return this.svgElement.children[i].getAttribute('visibility') === 'visible';
    }

    public deleteLayer(i: number) {
        if (this.getLayerType(i) === 'Existing Mask') {
            this.loadedMask = false;
        }
        this.svgElement.children[i].remove();
    }

    getMimeType(base64: string): string | undefined {
        const marker = ';base64,';
        const parts = base64.split(marker);
        if (parts.length === 2) {
            const contentType = parts[0].split(':')[1];
            return contentType;
        }
        return undefined;
    }

    extractBase64FromDataURI(dataURI: string): string {
        const base64String = dataURI.split(',')[1];
        return base64String;
    }

    async saveZipYoloAll(fileContents: any[],  images) {
        const zip = new JSZip();
        const labelsFolder = zip.folder('labels');
        const imagesFolder = zip.folder('images');

        fileContents.forEach(file => {
            labelsFolder.file(file[0], file[1]);
        });
        images.forEach( image => {
            const base64Data = this.extractBase64FromDataURI(image.data as string);

            const binaryString = atob(base64Data as string);
            // Convert binary string to Uint8Array
            const byteArray = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                byteArray[i] = binaryString.charCodeAt(i);
            }
            // Get MIME type
            const mimeType = this.getMimeType(image.data as string);
            // Create Blob from Uint8Array
            const blob = new Blob([byteArray], { type: mimeType });

            // Create File object
            const imgFile = new File([blob], image.name);
            imagesFolder.file(image.name, imgFile);
        })
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        saveAs(zipBlob, this.projectName + '.zip');
    }

    public exportToYoloAll() {
        const $ = cheerio.load(this.svgElement.innerHTML);
        const transform = []
        $('g').each((index, element) => {
            const move = $(element).attr('transform') ? $(element).attr('transform') : "0,0"
            transform.push(move)
        });
        const regex = /-?\d+(\.\d+)?/g;
        const extractNumbers = (str: string): number[] => {
            const matches = str.match(regex);
            if (matches) {
                return matches.map(match => parseFloat(match));
            }
            return [];
        };
        const moveXY = transform.map(extractNumbers);
        let fileContents= [];
        for (let image of this.projectImageData) {
            const height = image.height;
            const width = image.width;

            let yoloTxt = "";
            let indexClass = "";

            $('polygon').each((index, element) => {
                if ($(element).parent('g').attr('id') === image.name) {
                    const pointsAttribute = $(element).attr('points')?.split(',').map((point, i) => {
                        const parsedPoint = Number(point);
                        const colorAttribute = $(element).parent('g').attr('color');
                        indexClass = environment.project[this.projectIndex].colors.findIndex(item => item.color === colorAttribute.toString()).toString();
                        return (i % 2 === 0) ? ((parsedPoint + moveXY[index][0]) / width) : ((parsedPoint+ moveXY[index][1]) / height);
                    }).join(' ');

                    yoloTxt = yoloTxt + `${indexClass} ${pointsAttribute}\n`;
                }
            });
            if (yoloTxt.length > 0) {
                fileContents.push([image.name.replace(/\.[^/.]+$/, "") + ".txt", yoloTxt])
            }
        }
        this.saveZipYoloAll(fileContents, this.projectImageData);
    }

    public exportToYolo(image: string) {
        const $ = cheerio.load(this.svgElement.innerHTML);
        const transform = []
        $('g').each((index, element) => {
            const move = $(element).attr('transform') ? $(element).attr('transform') : "0,0"
            transform.push(move)
        });
        const regex = /-?\d+(\.\d+)?/g;
        const extractNumbers = (str: string): number[] => {
            const matches = str.match(regex);
            if (matches) {
                return matches.map(match => parseFloat(match));
            }
            return [];
        };
        const moveXY = transform.map(extractNumbers);
        let yoloTxt = "";
        let indexClass = "";

        let selectedImage = this.projectImageData.filter(x=> x.name == image)
        let fileContents= [];
        const height = selectedImage[0].height;
        const width = selectedImage[0].width;

        $('polygon').each((index, element) => {
            if ($(element).parent('g').attr('id') === selectedImage[0].name) {
                const pointsAttribute = $(element).attr('points')?.split(',').map((point, i) => {
                    const parsedPoint = Number(point);
                    const colorAttribute = $(element).parent('g').attr('color');
                    indexClass = environment.project[this.projectIndex].colors.findIndex(item => item.color === colorAttribute.toString()).toString();
                    return (i % 2 === 0) ? ((parsedPoint + moveXY[index][0]) / width) : ((parsedPoint+ moveXY[index][1]) / height);
                }).join(' ');

                yoloTxt = yoloTxt + `${indexClass} ${pointsAttribute}\n`;
            }
        });
        if (yoloTxt.length > 0) {
            fileContents.push([selectedImage[0].name.replace(/\.[^/.]+$/, "") + ".txt", yoloTxt])
        }
        this.saveZipYoloAll(fileContents, [selectedImage[0]]);
    }

    public segmentationAnotation(imageName = "") {
        const $ = cheerio.load(this.svgElement.innerHTML);
        const transform = []
        $('g').each((index, element) => {
            const move = $(element).attr('transform') ? $(element).attr('transform') : "0,0"
            transform.push(move)
        });
        const regex = /-?\d+(\.\d+)?/g;
        const extractNumbers = (str: string): number[] => {
            const matches = str.match(regex);
            if (matches) {
                return matches.map(match => parseFloat(match));
            }
            return [];
        };
        const moveXY = transform.map(extractNumbers);
        let indexClass = 0;
        let annotationArray: AnnotationCoco[] = [];
        if (imageName != "") {
            let image = this.projectImageData.filter(x => x.name == this.selectedImage);
            $('polygon').each((index, element) => {
                let xPoints = [];
                let yPoints = [];
                if ($(element).parent('g').attr('id') === image[0].name) {
                    const pointsAttribute = $(element).attr('points')?.split(',').map((point, i) => {
                            const parsedPoint = Number(point);
                            const colorAttribute = $(element).parent('g').attr('color');
                            indexClass = environment.project[this.projectIndex].colors.findIndex(item => item.color === colorAttribute.toString());
                            i % 2 === 0 && xPoints.push(parsedPoint + moveXY[index][0]);
                            i % 2 != 0 && yPoints.push(parsedPoint+ moveXY[index][1]);
                            return (i % 2 === 0) ? ((parsedPoint + moveXY[index][0])) : ((parsedPoint+ moveXY[index][1]));
                        });

                    let annotation: AnnotationCoco = new AnnotationCoco (
                            this.idGenerator.generateUniqueId(),
                            image[0].id,
                            indexClass,
                            [pointsAttribute],
                            this.calcPolygonArea(xPoints, yPoints),
                            [Math.min(...xPoints), Math.min(...yPoints),
                                Math.max(...xPoints) - Math.min(...xPoints),
                                Math.max(...yPoints) - Math.min(...yPoints)],
                            0)
                        annotationArray.push(annotation);
                    }
            });
        } else {
            for (let image of this.projectImageData) {
                $('polygon').each((index, element) => {
                    let xPoints = [];
                    let yPoints = [];
                    if ($(element).parent('g').attr('id') === image.name) {
                        const pointsAttribute = $(element).attr('points')?.split(',').map((point, i) => {
                            const parsedPoint = Number(point);
                            const colorAttribute = $(element).parent('g').attr('color');
                            indexClass = environment.project[this.projectIndex].colors.findIndex(item => item.color === colorAttribute.toString());
                            i % 2 === 0 && xPoints.push(parsedPoint + moveXY[index][0]);
                            i % 2 != 0 && yPoints.push(parsedPoint+ moveXY[index][1]);
                            return (i % 2 === 0) ? ((parsedPoint + moveXY[index][0])) : ((parsedPoint+ moveXY[index][1]));
                        });

                        let annotation: AnnotationCoco = new AnnotationCoco (
                            this.idGenerator.generateUniqueId(),
                            image.id,
                            indexClass,
                            [pointsAttribute],
                            this.calcPolygonArea(xPoints, yPoints),
                            [Math.min(...xPoints), Math.min(...yPoints), Math.max(...xPoints), Math.max(...yPoints)],
                            0)

                        annotationArray.push(annotation);
                    }
                });
            }
        }
        return annotationArray;
    }

    private calcPolygonArea(xPoints, yPoints) {
        var total = 0;
        for (var i = 0, l = xPoints.length; i < l; i++) {
            var addX = xPoints[i];
            var addY = yPoints[i == xPoints.length - 1 ? 0 : i + 1];
            var subX = xPoints[i == xPoints.length - 1 ? 0 : i + 1];
            var subY = yPoints[i];

            total += (addX * addY * 0.5);
            total -= (subX * subY * 0.5);
        }

        return Math.abs(total);
    }

    private formatDate(date: Date): string {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${year}/${month}/${day}`;
    }

    public exportToCocoAll() {
        let licenseId = this.idGenerator.generateUniqueId()

        let infoCoco = new InfoCoco(new Date().getFullYear(), "1.0", "COCO Dataset", "", "http://cocodataset.org", this.formatDate(new Date()));
        let licensesCoco: LicenseCoco[] = [new LicenseCoco(licenseId, "Attribution License" ,"http://creativecommons.org/licenses/by/2.0/")];
        let imagesCoco: ImageCoco[] = [];
        for (let image of this.projectImageData) {
            imagesCoco.push(new ImageCoco(image.id, image.width, image.height, image.name, licenseId, this.datePipe.transform(new Date(), 'yyyy-MM-dd HH:mm:ss')))
        }
        let categoriesCoco: CategoryCoco[] = [];
        for (let category of environment.project[this.projectIndex].colors) {
            categoriesCoco.push(new CategoryCoco(environment.project[this.projectIndex].colors.findIndex(item => item.color === category.color), category.name,""))
        }
        let annotationsCoco: AnnotationCoco[] = this.segmentationAnotation();

        let coco: Coco = new Coco(infoCoco,licensesCoco,categoriesCoco,imagesCoco,annotationsCoco);

        let blob = new Blob([JSON.stringify(coco)], { type: 'application/json' })
        saveAs(blob, this.projectName + '.json')
    }

    public exportToCoco() {
        let licenseId = this.idGenerator.generateUniqueId()
        let infoCoco = new InfoCoco(new Date().getFullYear(), "1.0", "COCO Dataset", "", "http://cocodataset.org", this.formatDate(new Date()));
        let licensesCoco: LicenseCoco[] = [new LicenseCoco(licenseId, "Attribution License" ,"http://creativecommons.org/licenses/by/2.0/")];
        let imagesCoco: ImageCoco[] = [];
        let image = this.projectImageData.filter(x => x.name == this.selectedImage);
        imagesCoco.push(new ImageCoco(image[0].id, image[0].width, image[0].height, image[0].name, licenseId, this.datePipe.transform(new Date(), 'yyyy-MM-dd HH:mm:ss')))
        let categoriesCoco: CategoryCoco[] = [];
        for (let category of environment.project[this.projectIndex].colors) {
            categoriesCoco.push(new CategoryCoco(environment.project[this.projectIndex].colors.findIndex(item => item.color === category.color), category.name,""))
        }
        let annotationsCoco: AnnotationCoco[] = this.segmentationAnotation(this.selectedImage);

        let coco: Coco = new Coco(infoCoco,licensesCoco,categoriesCoco,imagesCoco,annotationsCoco);

        let blob = new Blob([JSON.stringify(coco)], { type: 'application/json' });
        saveAs(blob, this.selectedImage + '.json')
    }

    public deleteAllLayers() {
        if (this.drawing) { return; }
        if (confirm('Warning: This will remove all current layers')) {
            this.svg.selectAll('g').remove();
        }
    }

    public deleteCurrentLayer() {
        if (!this.drawing) { return; }
        this.drawing = false;
        this.startPoint = [];
        this.points = [];
        this.svg.select('g.drawPoly').remove();
    }


    @HostListener('document:keyup', ['$event'])
    handleKeyboardEvent(event: KeyboardEvent) {
        if (event.code === 'Escape') { this.deleteCurrentLayer(); }
        if (event.code === 'KeyZ') { this.toggleControlPoints(); }
        if (event.code === 'Enter') { this.setLayerType(); }
        if (event.code === 'KeyQ') { this.changeRectangleMode(); }
        if (event.code === 'Backspace') { this.undo(); }
        if (event.code === 'Numpad0' || event.code === 'Digit0') { this.panZoomAPI.resetView() }
    }

    public getLayerType(i: number): string {

        const colors = [['#402020 completePoly', 'Farba A'], ['#ff0000 completePoly', 'Farba B'], ['#808060 completePoly', 'Farba C'],
            ['#00ff66 completePoly', 'Fatba D'], ['#cc00ff completePoly', 'Farba E'], ['#00ccff completePoly', 'Existing Mask'], ['existingMask completePoly', 'Farba G']];
        for (const color of colors) {
            if (color[0] === this.svgElement.children[i].getAttribute('class')) {
                return color[1];
            }
        }
        return 'Načítavam';
    }


    public readonly environment = environment;
}
