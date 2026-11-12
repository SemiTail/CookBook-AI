import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogQuality} from './catalogQuality.ts';
test('catalog audit preserves zero values, skips accessories and checks ranges',()=>{
 const base={category:'Овочі',nutritionStatus:'verified',caloriesPer100g:0,proteinPer100g:0,fatPer100g:0,carbsPer100g:0};
 assert.deepEqual(catalogQuality([{...base,id:'1',name:'Вода'},{id:'2',name:'Шпажки',category:'Подача',nutritionStatus:'not_food'}]),[]);
 const issues=catalogQuality([{...base,id:'1',name:'М’ята'},{...base,id:'2',name:"м'ята"},{id:'3',name:'Продукт',category:'',nutritionStatus:'range',nutritionRange:{kcal:{min:20,max:10}}}]);
 assert.equal(issues.length,3);assert.ok(issues.find(x=>x.id==='1')?.reasons.includes('Можливий дублікат назви'));assert.equal(issues.find(x=>x.id==='3')?.reasons.length,2);
});
