import {DepartedBadge} from './DepartedBadge';
import {Link} from "react-router-dom";
import {Avatar} from "./RecipeDiscussion";
import {getSession} from "./api";
export type RecipePerson={deletedAt?:string|null;id:string;name:string;profile:{avatarUrl:string|null}|null};
export function RecipeAuthors({author,original}:{author?:RecipePerson|null;original?:RecipePerson|null}) {
 if(!author)return <p className="muted">Автор рецепта недоступний</p>;
 return <div className="recipe-authors"><Link className="recipe-author" aria-label={"Профіль автора "+author.name} to={"/users/"+author.id}><Avatar key={author.profile?.avatarUrl} url={author.profile?.avatarUrl} name={author.name}/><span><small>Автор рецепта</small><strong>{author.name}</strong><DepartedBadge deletedAt={author.deletedAt} label/></span></Link>{getSession()?.user.role==="MODERATOR"&&original&&original.id!==author.id&&<span className="original-author">[<Link title="Першочерговий автор" aria-label={"Першочерговий автор "+original.name} to={"/users/"+original.id}><Avatar key={original.profile?.avatarUrl} url={original.profile?.avatarUrl} name={original.name}/><s>{original.name}</s><DepartedBadge deletedAt={original.deletedAt}/></Link>]</span>}</div>;
}
