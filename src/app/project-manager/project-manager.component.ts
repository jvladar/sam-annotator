import {Component, OnInit, ViewChild, ViewChildren} from '@angular/core';
import {MaskingService} from "../services/masking.service";
import {environment} from "../../environments/environment";
import {ImageFileDatas} from "../models/imageFileDatas";

@Component({
  selector: 'app-project-manager',
  templateUrl: './project-manager.component.html',
  styleUrls: ['./project-manager.component.css']
})
export class ProjectManagerComponent implements OnInit {

  public readonly environment = environment;

  @ViewChild('projectname') projectname;
  @ViewChildren('editname') editname;
  public imageFileDatas: ImageFileDatas[] = [];
  projectIndex: number;
  currentProject: string;
  public compactDropDownMenu = false;

  constructor(private maskSvc: MaskingService) { }

  ngOnInit(): void {
    this.currentProject = this.maskSvc.currentProject;
    this.compactDropDownMenu = true;
    this.projectIndex = environment.project.findIndex(e => e.name === this.maskSvc.currentProject);

    this.maskSvc.getImageFileDatas().subscribe(urlsData => {
      this.imageFileDatas = urlsData;
    });
  }

  public saveNewProject(){
    const newName = this.projectname.nativeElement.value;
    if (newName === "") {
      this.maskSvc.setModal('Názov triedy musí byť vyplnený');
      return;
    }

    environment.project.push({name: newName, colors: [{name: 'Trieda1', color: '#402020'}] })
    this.projectname.nativeElement.value = "";
  }

  public editProject(i : number) {
    const newProjectName = this.editname.toArray()[0].nativeElement.value;
    if (newProjectName === "") {
      this.maskSvc.setModal('Názov triedy musí byť vyplnený');
      return;
    }
    for (let index of environment.project) {
      if(index.name === newProjectName) {
        this.maskSvc.setModal('Názov triedy musí byť unikátny');
        this.editname.toArray()[i].nativeElement.value = "";
        return;
      }
    }
    const oldName = this.currentProject;
    environment.project[i].name = newProjectName;
    this.currentProject = newProjectName;
    let newImageData: ImageFileDatas[] = [];
    for (let image of this.imageFileDatas) {
      if (image.projectName == oldName) {
          image.projectName = newProjectName;
      }
      newImageData.push(image);
    }
    this.maskSvc.editProjectName(i);
    this.maskSvc.setImageFileDatas(newImageData);
  }

  public setProject(index: number){
    this.maskSvc.setProject(index);
    this.currentProject = this.maskSvc.currentProject;
    this.projectIndex = index;
  }

  public deleteProjectType(index: number){
    if (environment.project.length == 1) {
      this.maskSvc.setModal('Nemôžete vymazať projekt, vždy musí byť aktívny aspoň 1 projekt. Ak chcete vymazať tento projekt, vytvorte najprv nový projekt.');
      return
    }
    let projectToDelete = environment.project[index].name;

    let newImageData: ImageFileDatas[] = [];
    let imagesToDeleteWithProject: string[] = [];
    for (let image of this.imageFileDatas) {
      if (image.projectName != projectToDelete) {
        newImageData.push(image);
      }
      else {
        imagesToDeleteWithProject.push(image.name)
      }
    }
    environment.project.splice(index,1);
    this.maskSvc.setEditedProject(0, newImageData, imagesToDeleteWithProject);

  }
}
