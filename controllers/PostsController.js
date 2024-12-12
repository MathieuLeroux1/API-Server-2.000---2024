import PostModel from '../models/post.js';
import Repository from '../models/repository.js';
import Controller from './Controller.js';

export default class PostModelsController extends Controller {
    constructor(HttpContext) {
        super(HttpContext, new Repository(new PostModel()));
    }
    removePostsByWriterId(writerId) {
        let data = this.repository.getAll(this.HttpContext.path.params);
    
        const initialCount = data.length;
    
        data = data.filter(post => post.WriterId !== writerId);
    
        data = data.map(post => {
            if (post.Image && post.Image.startsWith('http://localhost:5000/assetsRepository/')) {
                const imageFileName = post.Image.split('/').pop();
                post.Image = imageFileName;
            }
            return post;
        });
    
        this.repository.objectsList = data;
        this.repository.write();
    
        return initialCount - data.length;
    }
    
}