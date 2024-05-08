import {Component, ViewChild} from '@angular/core';
import {version} from 'package.json';
import {AnnotationChange} from "../models/annotation-change";
import {MaskingService} from "../services/masking.service";
import {Router} from "@angular/router";

@Component({
  selector: 'app-toolbar',
  templateUrl: './menu-bar.component.html',
  styleUrls: ['./menu-bar.component.css']
})
export class MenuBarComponent {
  public version: string = version;
  public rectMode = false;
  @ViewChild('toolbarcolor') toolbarcolor;
  @ViewChild('layername') layername;


  constructor(private maskSvc: MaskingService) { }

  public changeRectangleMode(){
    this.rectMode = true;
    this.maskSvc.changeEmit(new AnnotationChange({index: 0, type: 'rectangleMode'}));
  }

  public changePolygonMode(){
    this.rectMode = false;
    this.maskSvc.changeEmit(new AnnotationChange({index: 0, type: 'rectangleMode'}));
  }

}
