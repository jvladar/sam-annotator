import {Component, OnInit, TemplateRef, ViewChild} from '@angular/core';
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {MaskingService} from "../services/masking.service";

@Component({
  selector: 'app-mymodal',
  templateUrl: './mymodal.component.html',
  styleUrls: ['./mymodal.component.css']
})
export class MymodalComponent implements OnInit {

  public alertMessage;
  @ViewChild('mymodal') myModal: TemplateRef<any>;

  constructor(private maskSvc: MaskingService,
              private modalService: NgbModal) { }

  ngOnInit(): void {
    this.maskSvc.getModal().subscribe(content => {
      this.alertMessage = content;
      this.modalService.open(this.myModal);
    })
  }

}
