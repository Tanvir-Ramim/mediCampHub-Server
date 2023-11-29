const express= require("express")
const cors=require('cors')
require('dotenv').config()
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe=require('stripe')(process.env.Stripe_Key)
const app=express();
const port=process.env.PORT || 5000


// middleware
app.use(cors({
    origin:['http://localhost:5173'],
    credentials: true
}))
app.use(express.json())
app.use(cookieParser())


const verify=async (req,res,next)=>{
      const token=req.cookies?.token
      if(!token){
          return res.status(401).send({message:'Unauthorized access'})
      }
      jwt.verify(token,process.env.ACCESS_Token_SECRET,(error,decoded)=>{
         if(error){
          return res.status(401).send({message:'Unauthorized access'})
         }
         req.user=decoded 
         next()
      })
}



const uri =`mongodb+srv://${process.env.DB_User}:${process.env.DB_Password}@cluster0.sikjemj.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
       const usersCollection=client.db('MediCampsHub').collection('users')
       const campsCollection=client.db('MediCampsHub').collection('camps')
       const registerCollection=client.db('MediCampsHub').collection('register')
       const paymentCollection=client.db('MediCampsHub').collection('paymentInfo')
       const reviewCollection=client.db('MediCampsHub').collection('review')
         
       const verifyOrganizer=async(req,res,next)=>{
        const email= req.user.email
        const query={email:email}
        const user=await usersCollection.findOne(query)
        const isOrganizer= user?.role=== 'Organizer'
        if(!isOrganizer){
          return res.status(403).send({message:'forbidden access'})
        }
        next()
  }           
                   
                //  review related api 
               app.post('/review',async(req,res)=>{
                   try{
                    const reviewInfo=req.body
                   const result =await reviewCollection.insertOne(reviewInfo)
                   return res.send(result)
                   }
                   catch{
                    return res.send({error:true})
                   }
               })
                      
             app.get('/reviews',async(req,res)=>{
                try{
                  const result= await reviewCollection.find().toArray()
                return res.send(result)
                }
                catch{
                  return res.send({error:true})
                }
             })


              // payment
            
            app.post('/create-payment-intent',async(req,res)=>{
                try{
                  const {price}=req.body
                if(price==0){
                   return res.send('not')
                }
                 const amount=parseInt(price*100)
                   // console.log(amount)
                 const paymentIntent=await stripe.paymentIntents.create({
                     amount: amount,
                     currency: 'usd',
                     payment_method_types:[
                       'card'
                     ]
                 })
                 res.send({
                   clientSecret: paymentIntent.client_secret,
                 })
                }
                catch{
                  return res.send({error:true})
                }
             })

            app.post('/payment',verify, async(req,res)=>{
                 try{
                  const paymentInfo=req.body 
                  const result=await paymentCollection.insertOne(paymentInfo)
                  return res.send(result)
                 }
                 catch{
                  return res.send({error:true}) 
                 }
            })


            // after payment  

            app.put('/afterPayment',async(req,res)=>{
                try{
                  const {registerId,status}=req.body
                const query={_id: new ObjectId(registerId)}
                const updateInfo={
                    $set:{
                      paymentStatus: status
                    }
                }
                const result=await registerCollection.updateOne(query,updateInfo)
                return res.send(result)
                }
                catch{
                  return res.send({error:true})
                }
            })
            
            app.get('/emailPayment',verify ,async(req,res)=>{
              const deEmail= req.user.email
              const {email}=req.query
              if(email===deEmail){
                 const query={email: email}
                 const result=await paymentCollection.find(query).toArray()
                 return res.send(result)
              }
            })




      //  jwt 
      app.post('/jwt',async (req,res)=>{
           const user=req.body
           const token=jwt.sign(user,process.env.ACCESS_Token_SECRET,{expiresIn:'3000h'})

           res
           .cookie('token',token,{
              httpOnly: true,
              secure: process.env.NODE_ENV==='production'? true : false,
              sameSite:process.env.NODE_ENV==='production'? "none" : "strict"
           })
           .send({success: true})
      })
     
      app.post('/jwtRemove',async(req,res)=>{

        res.clearCookie('token',{
          maxAge:0,
          secure: process.env.NODE_ENV==='production'? true : false,
          sameSite:process.env.NODE_ENV==='production'? "none" : "strict"
        })
        .send({success:true})
    })

     
      // registration related api
      app.post('/register', verify,async (req,res)=>{
           try
           {
            const registerInfo=req.body 
            const result=await registerCollection.insertOne(registerInfo)
            return res.send(result)
           }
           catch
           {
            return res.send({error:true})
           }
      })

      app.delete('/deleteRegister/:id',async(req,res)=>{
           try{
            const id=req.params.id
            const query={_id: new ObjectId(id)}
            const result= await registerCollection.deleteOne(query)
            res.send(result)
           }
           catch{
            return res.send({error:true})
           }

      })

      app.put('/changeStatus',verify, verifyOrganizer,async(req,res)=>{
           const {id,status}=req.body
           const query={_id: new ObjectId(id)}
           const updateInfo={
             $set:{
              ConfirmationStatus: status
             }
           }
           const result=await registerCollection.updateOne(query,updateInfo)
           return res.send(result)
      })


      app.get('/register',verify,async(req,res)=>{
          try{
            const {email}= req.query
          if(email){
            const query={userMail: email}
            const result= await registerCollection.find(query).toArray()
            return res.send(result)
          }
          }
          catch
          {
            return res.send({error:true})
          }
      })

      app.get('/paidRegister',verify,async(req,res)=>{
         try
         {
          const {email}= req.query
          if(email){
            const query={userMail: email ,paymentStatus:'Paid' }
            const result= await registerCollection.find(query).toArray()
            return res.send(result)
          }
         }
         catch{
          return res.send({error:true})
         }
      })

      app.get('/registerAll',verify,verifyOrganizer,async(req,res)=>{
           try{
             const result=await registerCollection.find().toArray()
             return res.send(result)
           }
           catch{
            return res.send({error:true})
           }
      })
       

     
        
      //  camps related api
      app.post('/camps', async (req,res)=>{
           try{
            const campsInfo=req.body
           const result=await campsCollection.insertOne(campsInfo)
           return res.send(result)
           }
           catch{
            return res.send({error:true})
           }
      })

      app.delete('/camp/:id',verify,verifyOrganizer, async(req,res)=>{
             try{
                const id=req.params.id
                const query={_id: new ObjectId(id)}
                const result=await campsCollection.deleteOne(query)
                return res.send(result)
             }
             catch{
               return res.send({error:true})
             }
      })


      app.put('/updateCamp',verify,verifyOrganizer, async(req,res)=>{
            const info= req.body
            const query={_id: new ObjectId(info?.id)}
            const options={upsert:true}
            const { name, services, scheduled, location, fees, audience, healthCareName, details,healthPro}=info ||{}

            const updateInfo={
               $set:{
                name:name,
                scheduled:scheduled,
                audience:audience,
                details:details,
                fees: fees,
                healthPro: healthPro,
                location:location,
                services:services,
                healthCareName:healthCareName
               }
            }
            const result=await campsCollection.updateOne(query,updateInfo,options)
            return res.send(result)
      })
        //  ++++
      app.put('/participate',verify,async(req,res)=>{
            try{
              const {id,newParticipant}=req.body
            const query={_id:new ObjectId(id)}
             const newInfo={
                 $set:{
                  participant: newParticipant
                 }
             }

             const result=await campsCollection.updateOne(query,newInfo)
             return res.send(result)
            }
            catch{
              return res.send({error:true})
            }   
      })

      // ----
      app.put('/participateOut', async(req,res)=>{
          try{
            const {searchId}=req.body
            const query= {_id: new ObjectId(searchId)}
            const findData= await campsCollection.findOne(query)
            const {participant}=findData
             
           //  update
 
           const  newInfo={
             $set:{
               participant: participant-1
             }
           }
           const result=await campsCollection.updateOne(query,newInfo)
           return res.send(result)
          }
          catch{
            return res.send({error:true})
          }

      })

      app.put('/changeDecision',async (req,res)=>{
         try{
          const {changeDecision,id}=req.body
          const query={_id: new ObjectId(id)}
          const updateDecision= {
             $set:{
              healthcareDicison: changeDecision
             }
          }
          const result=await campsCollection.updateOne(query,updateDecision)
          return res.send(result)
         }
         catch{
          return res.send({error:true})
         }
      })
        
      app.get('/careWant',async(req,res)=>{
           try{
            const {email}=req.query
           const query={healthPro:email}
           const result=await campsCollection.find(query,{
            projection:{

              audience:0,
                 details:0,
                 image:0,
                 userEmail:0,
                 participant:0
            }
           }).toArray()
           return res.send(result)
           }
           catch{
            return res.send({error:true})
           }
      })



      app.get('/camps',async(req,res)=>{
          try{
             const result=await campsCollection.find().toArray()
             return res.send(result)
          }
          catch{
            return res.send({error:true})
          }
      })

      app.get('/topCamps',async(req,res)=>{
          try{
              const result=await campsCollection.find().sort({participant:-1}).limit(6).toArray()
             return res.send(result)
          } 
          catch{
            return res.send({error:true})
          }
      })
       
      app.get('/camp/:id',async(req,res)=>{
          try{
             const id=req.params.id
             const query={_id: new ObjectId(id)}
             const result= await campsCollection.findOne(query)
             return res.send(result)
          }
          catch{
            return res.send({error:true})
          }
      })

      app.get('/manageCamps', verify,async(req,res)=>{
          try
          {
            const {email}=req.query
            if(email){
              const query={userEmail: email}
              const result=await campsCollection.find(query,{
               projection:{
                 image:0,
                 services:0,
                 details:0,
                 healthPro:0,
                 services:0,
                 audience:0
               }
              }).toArray()
              return res.send(result)
            }
            else{
             return res.send({error:true})
            }
          }
          catch{
            return res.send({error:true})
          }
      })





      //  users related Api
     app.get('/userRole/:email', async(req,res)=>{
              try{
                const email=req.params.email
               const query={email:email}
               const result =await usersCollection.findOne(query,{
                projection:{
                  name: 0,
                  email:0,
                  _id: 0
                }
               })
             return   res.send(result)
              }
              catch{
                return res.send({error:true})
              }
     })
     
     app.get('/hp', async(req,res)=>{
             try{
              const role='Healthcare Professional'
              const query={role:role}
              const result =await usersCollection.find(query
              ).toArray()
              res.send(result)
             }
             catch{
              return res.send({error:true})
             }
     })
    
     app.post('/users',async(req,res)=>{
        try{
          const user=req.body 
        const query={email:user.email}
        const existingUser=await usersCollection.findOne(query)
        if(existingUser){
           return res.send({message: 'user already exists', insertedId: null})
        }
        const result=await usersCollection.insertOne(user)
       return  res.send(result)
        }
        catch{
          return res.send({error:true})
        }
     })
      
  


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);






app.get('/',(req,res)=>{
     res.send('Medical Camps Hub is running')
})

app.listen(port,()=>{
     console.log(`Medical Camps Hub Server is running on Port: ${port}`)
})