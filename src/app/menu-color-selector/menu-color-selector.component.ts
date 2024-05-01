import {Component, OnInit, HostListener, ViewChild, ViewChildren} from '@angular/core';
import { environment } from 'src/environments/environment';
import { MaskingService } from '../services/masking.service';
import {Annotation} from "../models/annotation";

@Component({
  selector: 'app-toolbar-color-selector',
  templateUrl: './menu-color-selector.component.html',
  styleUrls: ['./menu-color-selector.component.css']
})
export class MenuColorSelectorComponent implements OnInit {

  @ViewChild('toolbarcolor') toolbarcolor;
  @ViewChild('layername') layername;
  @ViewChildren('editcolor') editcolor;
  @ViewChildren('editname') editname;
  public layers: Annotation[];
  public colors = [];
  public projectName : string;
  public projectIndex: number;
  public ntype = environment.project[0].colors[0];
  public compactDropDownMenu = false;
  public layerClassTrueFalse = false;

  constructor(public maskSvc: MaskingService) { }

  ngOnInit(): void {
    this.projectName = environment.project[0].name;
    this.projectIndex = environment.project.findIndex(e => e.name === this.projectName);

    this.maskSvc.getLayers().subscribe(layers => {
      this.layers = layers;
    })

    this.maskSvc.getProjectChange().subscribe(name => {
      this.projectName = name;
      this.projectIndex = environment.project.findIndex(e => e.name === this.projectName);
      this.colors = environment.project[this.projectIndex].colors;
    })

    this.selectMenuLayout(window.innerWidth);

  }

  public selectMenuLayout(windowWidth) {
    this.compactDropDownMenu = true;
    this.colors = environment.project[this.projectIndex].colors;
  }

  public saveNewLayer(){
    const newColorName = this.layername.nativeElement.value;
    if (newColorName === "") {
      this.maskSvc.setModal('Názov triedy musí byť vyplnený');
      return;
    }
    for (let i of this.colors) {
      if(i.name === newColorName) {
        this.maskSvc.setModal('Názov triedy musí byť unikátny');
        this.layername.nativeElement.value = "";
        return;
      }
    }
    environment.project[this.projectIndex].colors.push({color: this.toolbarcolor.nativeElement.value, name: this.layername.nativeElement.value})
    this.colors = environment.project[this.projectIndex].colors;
    this.layername.nativeElement.value = "";
  }

  public editLayerType(i: number){
    const newColorName = this.editname.toArray()[i].nativeElement.value;
    const newColor = this.editcolor.toArray()[i].nativeElement.value;
    if (newColorName === "") {
      this.maskSvc.setModal('Názov triedy musí byť vyplnený');
      return;
    }
    let y = 0;
    for (let index of this.colors) {
      if(index.name === newColorName && i != y) {
        this.maskSvc.setModal('Názov triedy musí byť unikátny');
        this.editname.toArray()[i].nativeElement.value = "";
        return;
      }
      if(index.color === newColor && i != y) {
        this.maskSvc.setModal('Farba triedy musí byť unikátna');
        return;
      }
      y++;
    }
    const oldColor = environment.project[this.projectIndex].colors[i].color;
    environment.project[this.projectIndex].colors[i].color = newColor;
    environment.project[this.projectIndex].colors[i].name = newColorName;
    this.colors = environment.project[this.projectIndex].colors;
    this.maskSvc.setLayers(oldColor, newColor);
  }

  public fixLayerType(){
    this.layerClassTrueFalse = !this.layerClassTrueFalse;
    this.maskSvc.fixLayerType();
  }

  public deleteLayerType(index: number){
    let color = environment.project[this.projectIndex].colors[index].color
    for (const layer of this.layers) {
      if (layer.type === color) {
        this.maskSvc.setModal("Túto triedu nemôžete vymazať pretože sa používa")
        return;
      }
    }
    if (environment.project[this.projectIndex].colors.length == 1) {
      this.maskSvc.setModal("Túto triedu nemôžete vymazať, vždy musí byť dostupná minimálne 1 trieda")
      return;
    }
    environment.project[this.projectIndex].colors.splice(index,1)
    this.colors = environment.project[this.projectIndex].colors;
  }

  public setColor(index: number){
    this.ntype = this.colors[index];
    if (this.compactDropDownMenu) {
      this.maskSvc.setColor(environment.project[this.projectIndex].colors.findIndex(e => e.name === this.ntype.name));
      this.colors = environment.project[this.projectIndex].colors;
    } else {
      this.maskSvc.setColor(environment.project[this.projectIndex].colors.findIndex(e => e.name === this.ntype.name));
      this.colors = environment.project[this.projectIndex].colors;
    }
  }


  @HostListener('document:keyup', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    const KeyMap = ['KeyR', 'KeyL', 'KeyU', 'KeyM', 'KeyC'];
    if (KeyMap.includes(event.code)) {
      const index = KeyMap.findIndex(e => e === event.code);
      if (this.compactDropDownMenu) {
        const name = environment.project[this.projectIndex].colors[index].name;
        if (name !== this.ntype.name) {
          this.setColor(this.colors.findIndex(e => e.name === name));
        }
      } else {
        this.setColor(index);
      }
    }
  }
  
  @HostListener('window:resize', ['$event'])
  onResize(event) {
    this.selectMenuLayout(window.innerWidth);
  }
}
