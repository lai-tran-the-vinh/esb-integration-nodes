import http from 'k6/http';
import { check } from 'k6';

export default function () {
  const params = {
    headers: {
      'Origin': 'http://localhost:3000', // Truyền đúng Origin được hệ thống cho phép
    },
  };

  let res = http.get('http://host.docker.internal:8290/api/v1/products', params);
  
  check(res, { 
    'status was 200': (r) => r.status == 200 
  });
}