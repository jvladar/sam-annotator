import {Component, HostListener, OnInit, ViewChild} from '@angular/core';
import * as io from 'socket.io-client';
import * as d3 from 'd3';
import {MaskingService} from "../services/masking.service";
import {ActivatedRoute, Router} from "@angular/router";
import {ImageFileDatas} from "../models/imageFileDatas";
import {environment} from "../../environments/environment";
import {PanZoomAPI, PanZoomConfig, PanZoomModel} from "ng2-panzoom";
import {Subscription} from "rxjs";
import * as cloneDeep from 'node_modules/lodash.clonedeep';
import {saveAs} from "file-saver";
import * as cheerio from 'cheerio';
import {UnigueIdGeneratorService} from "../services/unigue-id-generator.service";

declare const getImagesMap: (...args: any[]) => Map<string, string>;

enum ActiveMode {
  click_mode,
  all_masks_mode,
  bounding_box_mode,
  default
}

@Component({
  selector: 'app-sam',
  templateUrl: './sam.component.html',
  styleUrls: ['./sam.component.css']
})
export class SamComponent implements OnInit {

  socket : any;
  private elem: HTMLElement | null = null;
  activeMode: ActiveMode = ActiveMode.click_mode;
  @ViewChild('artboardSam') artboard;
  public svgElement;
  private startPosX = 0;
  private startPosY = 0;
  private drawing = false;
  public points = [];
  public g;
  public startPoint = [];
  public closedPolygon = false;
  public dragging = false;
  public history = [];
  public opacity = 60;

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
  public selectedImage = "";
  public processingImage = false;
  private panZoomAPI: PanZoomAPI;
  public panzoomModel: PanZoomModel;
  private apiSubscription: Subscription;
  private modelChangedSubscription: Subscription;
  public userId = "";
  public svg;
  public imageFileDatas: ImageFileDatas[] = [];
  public loadedMask = false;

  public projectName : string;
  public projectIndex: number;

  public width = 0;
  public height = 0;


  constructor(private activatedRoute: ActivatedRoute,
              private maskSvc: MaskingService,
              private router: Router,
              private idGenerator: UnigueIdGeneratorService) {
    this.elem = document.getElementById('imageee');
  }

  ngAfterViewInit(): void {
    this.maskSvc.setArtboard(this.artboard.nativeElement.innerHTML);
    this.svgElement = this.artboard.nativeElement.children[0];
  }

  ngOnInit(): void {
    this.projectName = environment.project[0].name;
    this.projectIndex = environment.project.findIndex(e => e.name === this.projectName);

    this.socket = io.connect("http://127.0.0.1:5000",{
      reconnection: false
    });

    this.apiSubscription = this.panzoomConfig.api.subscribe((api: PanZoomAPI) => this.panZoomAPI= api);
    this.modelChangedSubscription = this.panzoomConfig.modelChanged.subscribe((model: PanZoomModel) => {
      this.onModelChanged(model);
      this.panzoomModel = model;
    });

    this.socket.on('show_image', image_data => {
      const blob = new Blob([image_data], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      this.changeImageShowSam(url);
      this.processingImage = false;
    });

    this.socket.on('masks', masksData => {
      for (const mask  of masksData) {
        for (let point= 0; point < mask.length; point = point+2) {
          this.points.push([mask[point],mask[point+1]])
        }
        let num_colors = this.environment.project[this.projectIndex].colors.length;
        if (this.activeMode === ActiveMode.all_masks_mode) {
          this.maskSvc.setColor(this.getRandomInt(num_colors-1));
        }
        this.closePolygon()
      }
    });

    this.maskSvc.getUploadedLayers().subscribe(content => {
      const fileName = content[0];
      const selectedImage = this.selectedImage;
      this.selectedImage = fileName.substring(0,fileName.length-4);
      const lines = content[1].split('\n');
      const height = this.svgElement.getAttribute('height');
      const width = this.svgElement.getAttribute('width');
      for (const line of lines) {
        const values = line.split(' ').map((value) => parseFloat(value.trim()));
        const lineNumber = values[0];
        const doubles = values.slice(1);
        if(line.length > 0) {
          for (let point= 0; point < doubles.length; point = point+2) {
            this.points.push([doubles[point]*width,doubles[point+1]*height])
          }
          this.maskSvc.setColor(lineNumber)
          this.closePolygon()
        }
      }
      this.selectedImage = selectedImage;
      this.layersVisibilityForImage()
    })


    this.socket.on('click_response', event => {
      const x = event.x;
      const y = event.y;
    });

    this.svg = d3.select('.artboardSam').append('svg')
        .attr('background-size', '1000px '+ '1000px')
        .attr('height', 1000)
        .attr('width', 1000);

    this.activatedRoute.queryParams.subscribe(params => {
      this.userId = params.userId;
    });

    this.maskSvc.getImageFileDatas().subscribe(urlsData => {
      if (this.router.url == "/sam") {
        if (urlsData.length == 0) {
          this.width = 1000
          this.height = 1000;
          this.svg = d3.select('.artboardSam').select('svg')
                .attr('background-size', this.width + 'px ' + this.height + 'px')
                .attr('height', this.height)
                .attr('width', this.width);
          this.svg.style('background-image', ``);
        }
        else {
          if (this.selectedImage === "") {
            this.changeImageSam(urlsData[0])
          }
        }
        this.imageFileDatas = urlsData;
      }
    })

    this.maskSvc.getLayerChange().subscribe(obj => {
      if (obj.type === 'opacity') {
        this.svg.selectAll('.completePoly').attr('opacity', obj.index * .01);
        this.opacity = obj.index * .01;
      }
      if (obj.type === 'delete') {
        this.deleteLayer(obj.index);
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
      if (obj.type === 'yolo') {
        this.exportToYolo();
      }
      if (obj.type === 'toggleAll') {
        this.toggleAll();
      }
      if (environment.project[this.projectIndex].colors.map(e => e.color).includes(obj.type)) {
        this.updateColor(obj.index, obj.type);
      }
      this.setLayers();
    })
  }

  public getRandomInt(max) {
    return Math.floor(Math.random() * max);
  }

  public layersVisibilityForImage() {
    for (let layer of this.svgElement.children) {
      if (layer.getAttribute('id') != this.selectedImage) {
        layer.setAttribute('visibility', 'hidden');
      } else {
        layer.setAttribute('visibility', 'visible');
      }
    }
    this.setLayers();
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

  public deleteLayer(i: number) {
    this.svgElement.children[i].remove();
  }

  public deleteAllLayers() {
    if (this.drawing) { return; }
    if (confirm('Warning: This will remove all current layers')) {
      this.svg.selectAll('g').remove();
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
    if(imageName === this.selectedImage) {
      this.svg.style('background-image', ``);
      this.layersVisibilityForImage()
    }
    this.maskSvc.setImageFileDatas(fd);
  }

  public getVisibility(i: number): boolean {
    return this.svgElement.children[i].getAttribute('visibility') === 'visible';
  }

  public changeFromGoogle(){
    document.getElementById("signout_button").style.visibility = "visible";
    let a = document.getElementById("image") as HTMLImageElement;
    let urlsData: ImageFileDatas[] = [];
    let imagesMap: Map<string, string> = getImagesMap();
    imagesMap.forEach((value, key) => {
      let imageFile: ImageFileDatas = new ImageFileDatas();

      var image = new Image();
      image.src = value;
      image.onload = () => {
        imageFile.width = 1000;
        imageFile.projectName = this.projectName;
        imageFile.height = image.height / image.width * 1000;
        imageFile.id = this.idGenerator.generateUniqueId();
      };

      imageFile.data = value;
      imageFile.name = key;
      urlsData.push(imageFile);
    });
    this.maskSvc.setImageFileDatas(urlsData);
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

  public changeImageShowSam(imageData: any){
    this.svg = d3.select('.artboardSam').select('svg')
        .attr('height', imageData.height + 'px')
        .attr('width', 1000 + 'px');
    this.svg.style('background-size', '100% ' + '100%');
    this.layersVisibilityForImage();
    this.svg.style('background-image', `url('${imageData}')`);
  }

  public changeImageSam(imageData: any){
    if (!this.processingImage) {
      if (typeof imageData.data === "string") {
        var image = new Image();
        image.src = imageData.data;
        image.onload = () => {
          this.width = 1000;
          this.height = image.height / image.width * 1000;
          this.svg = d3.select('.artboardSam').select('svg')
              .attr('background-size', this.width + 'px ' + this.height + 'px')
              .attr('height', this.height)
              .attr('width', 1000);
        };
      }
      this.selectedImage = imageData.name;
      this.layersVisibilityForImage()
      this.socket.emit('set_image', { 'image': imageData.data});
    }
    this.svg.style('background-image', ``);
    this.processingImage = true;
  }

  onModelChanged(model: PanZoomModel): void {
    if (this.artboard && model.zoomLevel >= 1) {
      this.svg.selectAll('circle').attr('r', 4 / (model.zoomLevel / 1.5));
      this.svg.selectAll('polyline').attr('stroke-width', 1 / (model.zoomLevel / 2));
      this.svg.selectAll('circle').attr('stroke-width', 1 / (model.zoomLevel / 2));
    }
  }

  startPos(event: any): void {
    if (this.activeMode === ActiveMode.bounding_box_mode) {
      const x = event.offsetX;
      const y = event.offsetY;
      this.startPosX = x;
      this.startPosY = y;
      this.drawing = true;
    }
  }

  public mouseUp(e) {
    if(!this.drawing && e.altKey) {
      this.deleteLayerClick(e);
      return;
    }
    if(this.points.length == 0) {
      this.svg.select('g.drawPoly').remove();
    }
    this.g = this.svg.select('g.drawPoly');
    if (e.button !== 0) { return; }
    this.drawing = true;
    this.startPoint = [(e.layerX - this.panzoomModel.pan.x) *
    (1 / (this.artboard.nativeElement.getBoundingClientRect().width / this.artboard.nativeElement.offsetWidth)),
      (e.layerY - this.panzoomModel.pan.y) *
      (1 / (this.artboard.nativeElement.getBoundingClientRect().width / this.artboard.nativeElement.offsetWidth))];
    if (this.svg.select('g.drawPoly').empty()) {
      this.g = this.svg.append('g').attr('class', 'drawPoly');
      this.svg.selectAll('circle').attr('cursor', 'default');
    }
    if (this.activeMode != ActiveMode.bounding_box_mode || this.processingImage) {
      this.drawing = false;
      return;
    }
    if (e.toElement.tagName === 'circle') {
      this.setLayerType();
      return;
    }

    this.closedPolygon = false;
    this.g.select('line').remove();

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
      this.activeMode = ActiveMode.default;
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
  }

  public closePolygon(childPoly?: boolean) {
      let child = '';
      if (childPoly) {
        child = ' child';
      }
      this.svg.selectAll('circle').attr('cursor', 'move');
      this.svg.select('g.drawPoly').remove();

      const g = this.svg.append('g').attr('class', this.maskSvc.currentColor.color + ' completePoly'+ child)
          .attr('layerHidden', 'false')
          .attr("id", this.selectedImage)
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
          .attr('opacity', this.opacity * .01)
          .style('fill', this.maskSvc.currentColor.color)

    if (this.panzoomModel.zoomLevel === 0) {
      this.panzoomModel.zoomLevel = 1;
    }

      if (this.activeMode === ActiveMode.bounding_box_mode) {
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
                      this.addToHistory(this.drawing, this.startPoint, this.g, this.points);
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
            this.addToHistory(this.drawing, this.startPoint, this.g, this.points);
          })
      );


      this.points.splice(0);
      this.drawing = false;
      this.setLayers();
      this.addToHistory(this.drawing, this.startPoint, this.g, this.points);
    }

  private setLayers(): void {
    this.maskSvc.updateMask({ d3: this.svg, dom: this.artboard.nativeElement, loadedMask: this.loadedMask });
  }

  public exportToYolo() {
    const height = this.svgElement.getAttribute('height');
    const width = this.svgElement.getAttribute('width');
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
    $('polygon').each((index, element) => {
      if ($(element).parent('g').attr('visibility') === 'visible') {
        const pointsAttribute = $(element).attr('points')?.split(',').map((point, i) => {
          const parsedPoint = Number(point);
          const colorAttribute = $(element).parent('g').attr('color');
          indexClass = environment.project[this.projectIndex].colors.findIndex(item => item.color === colorAttribute.toString()).toString();
          return (i % 2 === 0) ? ((parsedPoint + moveXY[index][0]) / width) : ((parsedPoint+ moveXY[index][1]) / height);
        }).join(' ');

        yoloTxt = yoloTxt + `${indexClass} ${pointsAttribute}\n`;
      }
    });
    const blob = new Blob([yoloTxt], {type: "text/plain;charset=utf-8"});
    saveAs(blob, this.selectedImage + ".txt");
  }

  public dragBody(e,d) {
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

  public handleDrag(e, rectOn?: boolean) {
    if (this.drawing) { return; }
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

  mouseMove(e){
    if (!this.drawing) { return; }
    const g = d3.select('g.drawPoly');
    if (e.target.tagName === 'line') { return; }
    if (e.target.className.baseVal === 'inProgressCircle') {
      g.select('line').attr('stroke-width', 1 / (this.panzoomModel.zoomLevel / 2));
      return;
    }

    if (this.activeMode === ActiveMode.bounding_box_mode) {
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

  clickModeOn() {
    this.activeMode = ActiveMode.click_mode;
  }

  defaultModeOn(){
    this.activeMode = ActiveMode.default;
  }

  boundingBoxModeOn() {
    this.activeMode = ActiveMode.bounding_box_mode
  }

  clickOnImage(event: any) {
    if (this.activeMode === ActiveMode.click_mode && !this.processingImage) {
      this.socket.emit('click', { 'x': event.offsetX, 'y': event.offsetY });
    }
  }

  getAllMasks() {
    this.activeMode = ActiveMode.all_masks_mode;
    this.socket.emit('multimask');
  }

  public addToHistory(drawing, startPoint, g, points): void {
    const collection = this.svgElement.innerHTML;
    this.history.unshift([JSON.stringify(collection), JSON.stringify(drawing),
      JSON.stringify(startPoint), cloneDeep(g), JSON.stringify(points)]);
    if (this.history.length > 15) {
      this.history.pop();
    }
  }

  @HostListener('document:keyup', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.code === 'Escape') { this.deleteCurrentLayer(); }
    if (event.code === 'KeyZ') { this.toggleControlPoints(); }
    if (event.code === 'Enter') { this.setLayerType(); }
    if (event.code === 'Backspace') { this.undo(); }
    if (event.code === 'Numpad0' || event.code === 'Digit0') { this.panZoomAPI.resetView() }
  }

  public undo(): void {
    if (this.history.length > 0) {
      this.svgElement.innerHTML = JSON.parse(this.history[0][0]);
      this.drawing = JSON.parse(this.history[0][1]);
      this.startPoint = JSON.parse(this.history[0][2]);
      this.g = this.history[0][3];
      this.points = JSON.parse(this.history[0][4]);
      this.history.shift();
    }
    this.enableDragging();
  }

  public toggleControlPoints(): void {
    if (this.svgElement.classList.contains('hideCircles')) {
      this.svgElement.classList.remove('hideCircles');
    } else {
      this.svgElement.classList.add('hideCircles');
    }
  }

  public deleteCurrentLayer() {
    if (!this.drawing) { return; }
    this.drawing = false;
    this.startPoint = [];
    this.points = [];
    this.svg.select('g.drawPoly').remove();
  }

  public enableDragging() {
    const holder = this;
    this.svg.selectAll('.dragCircle').call(d3.drag()
        .on('drag', function () {
          holder.handleDrag(this);
        })
        .on('end', () => {
          this.dragging = false;
          this.addToHistory(this.drawing, this.startPoint, this.g, this.points);
        })
    );
  }

  private deleteLayerClick(e): void {
    if (e.target.tagName === 'polygon') {
      e.target.parentNode.remove();
    }
    this.setLayers();
  }

  protected readonly environment = environment;
}
