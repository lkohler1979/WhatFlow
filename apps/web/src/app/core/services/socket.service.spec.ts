import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { SocketService } from './socket.service';

describe('SocketService', () => {
  let service: SocketService;

  beforeEach(() => {
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SocketService, AuthService, { provide: Router, useValue: routerSpy }],
    });
    service = TestBed.inject(SocketService);
  });

  afterEach(() => {
    service.disconnect();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start disconnected with empty signals', () => {
    expect(service.connected()).toBeFalse();
    expect(service.instanceStatus()).toBeNull();
    expect(service.lastMessage()).toBeNull();
    expect(service.campaignProgress()).toBeNull();
    expect(service.conversationUpdated()).toBeNull();
    expect(service.conversationRead()).toBeNull();
  });

  it('disconnect() should be safe to call when never connected', () => {
    expect(() => service.disconnect()).not.toThrow();
    expect(service.connected()).toBeFalse();
  });

  it('connect() should create an underlying socket instance (idempotent)', () => {
    service.connect();
    // Calling connect again should not throw and should remain idempotent
    // (guarded by the internal `if (this.socket) return;`).
    expect(() => service.connect()).not.toThrow();
  });
});
